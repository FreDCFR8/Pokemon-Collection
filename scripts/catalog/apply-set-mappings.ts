import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { EXCLUDED_SET_CODES, readSetMappingPlan, type SetMappingPlan } from './set-mapping-plan.ts';

type SetRow = { id: string; set_code: string; source?: string | null; source_id?: string | null };
type ReferenceRow = { id: string; set_catalog_id: string; source: string; external_id: string };
type Snapshot = { sets: SetRow[]; cardsCount: number; cardReferencesCount: number; collectionCardsCount: number; setReferencesCount: number };
export type MappingRunResult = { status: 'PASS' | 'FAIL'; plannedInserts: number; existingIdentical: number; conflicts: string[]; blockedItems: string[]; operationalErrors: string[]; databaseWrites: number; postcheckErrors: string[] };

async function readRows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`Read-only query mislukt (${label}): ${error.message}`);
  return data ?? [];
}

async function readCount(query: PromiseLike<{ count?: number | null; data: unknown[] | null; error: { message: string } | null }>, label: string): Promise<number> {
  const { count, data, error } = await query;
  if (error) throw new Error(`Read-only count-query mislukt (${label}): ${error.message}`);
  return count ?? data?.length ?? 0;
}

function addUnique(values: string[], value: string): void { if (!values.includes(value)) values.push(value); }
function sortUnique(values: string[]): string[] { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }

async function snapshot(supabase: SupabaseClient, setIds: string[]): Promise<Snapshot> {
  const sets = await readRows<SetRow>(supabase.from('sets_catalog').select('id,set_code,source,source_id').in('id', setIds), 'sets_catalog snapshot');
  const [cardsCount, cardReferencesCount, collectionCardsCount, setReferencesCount] = await Promise.all([
    readCount(supabase.from('cards_catalog').select('id', { count: 'exact', head: true }), 'cards_catalog snapshot'),
    readCount(supabase.from('card_external_references').select('id', { count: 'exact', head: true }), 'card_external_references snapshot'),
    readCount(supabase.from('collection_cards').select('id', { count: 'exact', head: true }), 'collection_cards snapshot'),
    readCount(supabase.from('set_external_references').select('id', { count: 'exact', head: true }), 'set_external_references snapshot'),
  ]);
  return { sets: [...sets].sort((a, b) => a.set_code.localeCompare(b.set_code)), cardsCount, cardReferencesCount, collectionCardsCount, setReferencesCount };
}

function snapshotsEqual(before: Snapshot, after: Snapshot): boolean {
  return JSON.stringify({ ...before, setReferencesCount: undefined }) === JSON.stringify({ ...after, setReferencesCount: undefined });
}

export async function runSetMappings(params: { plan: SetMappingPlan; supabase: SupabaseClient; write?: boolean; confirmPlanHash?: string }): Promise<MappingRunResult> {
  const result: MappingRunResult = { status: 'FAIL', plannedInserts: 0, existingIdentical: 0, conflicts: [], blockedItems: [], operationalErrors: [], databaseWrites: 0, postcheckErrors: [] };
  if (params.write && params.confirmPlanHash !== params.plan.planHash) { result.blockedItems.push('plan_hash_confirmation_required'); return result; }
  try {
    const mappings = params.plan.mappings;
    const setCodes = mappings.map((mapping) => mapping.setCode);
    const sets = await readRows<SetRow>(params.supabase.from('sets_catalog').select('id,set_code,source,source_id').in('set_code', setCodes), 'sets_catalog');
    const byCode = new Map<string, SetRow>();
    for (const row of sets) { if (byCode.has(row.set_code)) addUnique(result.conflicts, `duplicate_internal_set_code:${row.set_code}`); else byCode.set(row.set_code, row); }
    for (const mapping of mappings) if (!byCode.has(mapping.setCode)) addUnique(result.blockedItems, `missing_internal_set:${mapping.setCode}`);
    const plannedSetIds = [...byCode.values()].map((row) => row.id);
    const before = params.write ? await snapshot(params.supabase, plannedSetIds) : undefined;

    // A: all rows for the planned source/external IDs.
    const refsByExternal = await readRows<ReferenceRow>(params.supabase.from('set_external_references').select('id,set_catalog_id,source,external_id').eq('source', 'pokemon_tcg_api').in('external_id', setCodes), 'references by external ID');
    // B: all rows for the planned source/internal set IDs, including other external IDs.
    const refsBySet = plannedSetIds.length === 0 ? [] : await readRows<ReferenceRow>(params.supabase.from('set_external_references').select('id,set_catalog_id,source,external_id').eq('source', 'pokemon_tcg_api').in('set_catalog_id', plannedSetIds), 'references by set ID');
    const refs = [...new Map([...refsByExternal, ...refsBySet].map((row) => [row.id, row])).values()].sort((a, b) => a.id.localeCompare(b.id));
    const refsForExternal = new Map<string, ReferenceRow[]>(); const refsForSet = new Map<string, ReferenceRow[]>();
    for (const ref of refs) {
      if (!ref.set_catalog_id) addUnique(result.conflicts, `dangling_set_catalog_id:${ref.id}`);
      const externalKey = `${ref.source}:${ref.external_id}`; refsForExternal.set(externalKey, [...(refsForExternal.get(externalKey) ?? []), ref]);
      const setKey = `${ref.set_catalog_id}:${ref.source}`; refsForSet.set(setKey, [...(refsForSet.get(setKey) ?? []), ref]);
    }
    for (const [key, matches] of refsForExternal) if (matches.length > 1) addUnique(result.conflicts, `multiple_source_external_references:${key}`);
    for (const [key, matches] of refsForSet) if (matches.length > 1) addUnique(result.conflicts, `multiple_set_source_references:${key}`);
    const referencedSetIds = [...new Set(refs.map((ref) => ref.set_catalog_id).filter(Boolean))];
    if (referencedSetIds.length > 0) {
      const referencedSets = await readRows<{ id: string }>(params.supabase.from('sets_catalog').select('id').in('id', referencedSetIds), 'referenced sets');
      const existingSetIds = new Set(referencedSets.map((row) => row.id));
      for (const id of referencedSetIds) if (!existingSetIds.has(id)) addUnique(result.conflicts, `dangling_set_catalog_id:${id}`);
    }

    const inserts: Array<Record<string, string>> = [];
    for (const mapping of mappings) {
      if ((EXCLUDED_SET_CODES as readonly string[]).includes(mapping.setCode)) { addUnique(result.blockedItems, `excluded_set:${mapping.setCode}`); continue; }
      const set = byCode.get(mapping.setCode); if (!set) continue;
      const externalMatches = refsForExternal.get(`${mapping.source}:${mapping.externalId}`) ?? [];
      const setMatches = refsForSet.get(`${set.id}:${mapping.source}`) ?? [];
      for (const ref of externalMatches) if (ref.set_catalog_id !== set.id) addUnique(result.conflicts, `external_id_other_set:${mapping.externalId}`);
      for (const ref of setMatches) if (ref.external_id !== mapping.externalId) addUnique(result.conflicts, `internal_set_other_external_id:${mapping.setCode}`);
      if (externalMatches.length === 1 && setMatches.length === 1 && externalMatches[0].set_catalog_id === set.id && setMatches[0].external_id === mapping.externalId) result.existingIdentical += 1;
      else if (externalMatches.length === 0 && setMatches.length === 0) inserts.push({ set_catalog_id: set.id, source: mapping.source, external_id: mapping.externalId, source_url: mapping.sourceUrl });
    }
    result.plannedInserts = inserts.length;
    if (params.write) {
      if (result.conflicts.length || result.blockedItems.length || inserts.length > 41) return result;
      if (inserts.length > 0) { const { error } = await params.supabase.from('set_external_references').insert(inserts); if (error) throw new Error(`Bulk insert mislukt: ${error.message}`); result.databaseWrites = inserts.length; }
      const afterRefs = await readRows<ReferenceRow>(params.supabase.from('set_external_references').select('id,set_catalog_id,source,external_id').eq('source', 'pokemon_tcg_api').in('external_id', setCodes), 'postcheck references');
      for (const mapping of mappings) { const set = byCode.get(mapping.setCode); const matches = afterRefs.filter((row) => row.external_id === mapping.externalId); if (matches.length !== 1 || !set || matches[0].set_catalog_id !== set.id) addUnique(result.postcheckErrors, `postcheck_mapping:${mapping.setCode}`); }
      const after = await snapshot(params.supabase, plannedSetIds);
      if (!before || !snapshotsEqual(before, after)) addUnique(result.postcheckErrors, 'protected_table_snapshot_changed');
      if (before && after.setReferencesCount - before.setReferencesCount !== result.databaseWrites) addUnique(result.postcheckErrors, 'set_reference_count_mismatch');
      const excludedRefs = await readRows<ReferenceRow>(params.supabase.from('set_external_references').select('id,set_catalog_id,source,external_id').eq('source', 'pokemon_tcg_api').in('external_id', [...EXCLUDED_SET_CODES]), 'postcheck excluded references');
      if (excludedRefs.length > 0) addUnique(result.postcheckErrors, 'excluded_set_reference_present');
    }
    result.conflicts = sortUnique(result.conflicts); result.blockedItems = sortUnique(result.blockedItems); result.postcheckErrors = sortUnique(result.postcheckErrors);
    result.status = result.conflicts.length || result.blockedItems.length || result.operationalErrors.length || result.postcheckErrors.length ? 'FAIL' : 'PASS';
    return result;
  } catch (error) { result.operationalErrors.push(error instanceof Error ? error.message : 'Onbekende operationele fout.'); return result; }
}

function parseArgs(argv: readonly string[]): { planPath: string; write: boolean; confirm?: string } { let planPath = ''; let write = false; let confirm: string | undefined; for (let i = 0; i < argv.length; i += 1) { if (argv[i] === '--plan') planPath = argv[++i] ?? ''; else if (argv[i] === '--write') write = true; else if (argv[i] === '--confirm-plan-hash') confirm = argv[++i]; else throw new Error(`Onbekend argument: ${argv[i]}`); } if (!planPath) throw new Error('--plan is verplicht.'); if (write && !confirm) throw new Error('--write vereist --confirm-plan-hash <planHash>.'); return { planPath, write, confirm }; }

if (process.argv[1]?.endsWith('apply-set-mappings.ts')) {
  try { const options = parseArgs(process.argv.slice(2)); const plan = readSetMappingPlan(options.planPath); const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.'); const result = await runSetMappings({ plan, supabase: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), write: options.write, confirmPlanHash: options.confirm }); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'PASS' ? 0 : 1; } catch (error) { console.error(`Setmappingrunner geblokkeerd: ${error instanceof Error ? error.message : 'onbekende fout'}`); process.exitCode = 1; }
}
