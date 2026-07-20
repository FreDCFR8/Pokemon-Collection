import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { localManifestIdentityFromText } from './catalog-manifest-identity.ts';
import { analysisHash, reportHash } from './catalog-report-identity.ts';
import { writeAtomicJson } from './checkpoint.ts';
import { buildCanonicalSetAnalysis, deterministicCatalogCardUuid, matchCards, type SetCatalogRow } from './import-set.ts';
import { loadPokemonTcgDataJson } from './local-json.ts';
import { validateLocalDatasetCheckout, PINNED_DATASET_VERSION, POKEMON_TCG_DATA_REPOSITORY } from './local-checkout.ts';
import { assertDatasetIdentity, assertIdempotent, assertNoUnexpectedWrites, classifyRemainingMapping, MANUAL_REVIEW_SETS, REMAINING_BATCH, REMAINING_PHASE, REMAINING_SET_COUNT, resumeChunks, sealWriteplan, validateApprovedArtifacts, type MappingAnalysis, type RemainingWritePlan, type ResumeCheckpoint } from './remaining-bulk-core.ts';

type Mode = 'dry-run' | 'write-approved';
type Options = { mode: Mode; dataset: string; manifest: string; report: string; writeplan: string; checkpoint: string; approvedReport?: string; batch: string; chunkSize: number; resume: boolean };
const value = (argv: string[], name: string): string | undefined => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1); };
export function parseRemainingBulkArgs(argv: string[]): Options {
  const mode = (value(argv, '--mode') ?? 'dry-run') as Mode;
  if (!['dry-run', 'write-approved'].includes(mode)) throw new Error('Gebruik --mode dry-run of write-approved.');
  const result: Options = { mode, dataset: value(argv, '--dataset') ?? '', manifest: value(argv, '--manifest') ?? '', report: value(argv, '--report') ?? '', writeplan: value(argv, '--writeplan') ?? '', checkpoint: value(argv, '--checkpoint') ?? '', approvedReport: value(argv, '--approved-report'), batch: value(argv, '--batch') ?? '', chunkSize: Number(value(argv, '--chunk-size') ?? '25'), resume: argv.includes('--resume') };
  if (!result.dataset || !result.manifest || !result.report || !result.writeplan || !result.checkpoint) throw new Error('--dataset, --manifest, --report, --writeplan en --checkpoint zijn verplicht.');
  if (result.batch !== REMAINING_BATCH) throw new Error(`--batch moet exact ${REMAINING_BATCH} zijn.`);
  if (!Number.isInteger(result.chunkSize) || result.chunkSize < 1 || result.chunkSize > 100) throw new Error('--chunk-size moet 1..100 zijn.');
  if (mode === 'write-approved' && !result.approvedReport) throw new Error('write-approved vereist --approved-report.');
  if (mode === 'dry-run' && result.resume && !existsSync(result.checkpoint)) throw new Error('--resume-checkpoint ontbreekt.');
  return result;
}

const rows = async <T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> => { const result = await query; if (result.error || !result.data) throw new Error(`${label}: ${result.error?.message ?? 'geen data'}`); return result.data; };
async function counts(db: SupabaseClient): Promise<Record<string, number>> { const out: Record<string, number> = {}; for (const table of ['cards_catalog', 'card_external_references', 'collection_cards', 'sets_catalog', 'set_external_references']) { const { count, error } = await db.from(table).select('id', { head: true, count: 'exact' }); if (error || count == null) throw new Error(`database_precheck_${table}`); out[table] = count; } return out; }

async function analyse(options: Options, db: SupabaseClient) {
  const manifestText = readFileSync(options.manifest, 'utf8'); const { manifest, manifestHash } = localManifestIdentityFromText(manifestText);
  validateLocalDatasetCheckout(options.dataset, PINNED_DATASET_VERSION);
  assertDatasetIdentity({ repository: manifest.datasetRepository, commit: manifest.datasetVersion, clean: true, manifestSets: manifest.sets.length, manifestCards: manifest.sets.reduce((sum, set) => sum + set.expectedCards, 0) });
  const refs = await rows<any>(db.from('set_external_references').select('set_catalog_id,source,external_id'), 'set_external_references');
  const catalogs = await rows<any>(db.from('sets_catalog').select('id,set_code,name,series,source,source_id'), 'sets_catalog');
  const catalogById = new Map(catalogs.map((row) => [row.id, row]));
  const reliable = refs.filter((row) => row.source === 'pokemon_tcg_api').map((row) => ({ ...catalogById.get(row.set_catalog_id), setCatalogId: row.set_catalog_id, externalId: row.external_id }));
  const reliableIds = new Set(reliable.map((item) => item.externalId));
  const remaining = manifest.sets.filter((set) => !reliableIds.has(set.setId) || (MANUAL_REVIEW_SETS as readonly string[]).includes(set.setId));
  if (remaining.length !== REMAINING_SET_COUNT) throw new Error(`remaining_set_count_mismatch:${remaining.length}`);
  const prechecks = await counts(db); const mapping: MappingAnalysis[] = []; const executable: typeof remaining = [];
  for (const set of remaining) {
    const local = loadPokemonTcgDataJson(resolve(options.dataset, set.jsonPath), set.setId);
    if (local.cards.length !== set.expectedCards) throw new Error(`received_cards_mismatch:${set.setId}`);
    const evidence = classifyRemainingMapping({ incomingSetId: set.setId, name: set.name, series: set.series, cardNumbers: local.cards.map((card) => card.number), reliableMappings: reliable.filter((item) => item.externalId === set.setId).map((item) => ({ setCatalogId: item.setCatalogId, setCode: item.set_code, externalId: item.externalId, name: item.name, series: item.series })), candidates: catalogs.filter((item) => item.set_code === set.setId || item.name === set.name).map((item) => ({ setCatalogId: item.id, setCode: item.set_code, name: item.name, series: item.series, cardNumbers: [] })) });
    mapping.push(evidence); if (evidence.classification === 'reliable_candidate') executable.push(set);
  }
  const perSet = [];
  for (const set of executable) { const local = loadPokemonTcgDataJson(resolve(options.dataset, set.jsonPath), set.setId); const selected = mapping.find((item) => item.incomingSetId === set.setId)!.selected!; const catalog = catalogById.get(selected.setCatalogId); const matching = await matchCards(db, { id: set.setId, name: set.name, series: set.series, total: local.cards.length, printedTotal: local.cards.length, releaseDate: '', updatedAt: '' } as never, local.cards as never, [{ id: selected.setCatalogId, set_code: selected.setCode, source: catalog.source, source_id: catalog.source_id, name: catalog.name, series: catalog.series } as SetCatalogRow]); perSet.push(buildCanonicalSetAnalysis({ setId: set.setId, setName: set.name, expectedCards: set.expectedCards, matching })); }
  return { manifest, manifestHash, remaining, prechecks, mapping, perSet };
}

async function dryRun(options: Options, db: SupabaseClient): Promise<void> {
  const result = await analyse(options, db); const blocked = result.mapping.filter((item) => item.classification !== 'reliable_candidate');
  const conflicts = result.perSet.flatMap((set) => set.actions.filter((item) => item.action === 'conflict'));
  const analysis = { phase: REMAINING_PHASE, mapping: result.mapping, perSet: result.perSet }; const aHash = analysisHash(analysis);
  const draft: any = { schemaVersion: 1, phase: REMAINING_PHASE, source: 'pokemon_tcg_data', datasetRepository: POKEMON_TCG_DATA_REPOSITORY, datasetVersion: PINNED_DATASET_VERSION, datasetCommit: PINNED_DATASET_VERSION, manifestHash: result.manifestHash, analysisHash: aHash, batch: REMAINING_BATCH, setsPlanned: result.perSet.length, setsProcessed: result.remaining.length, setsSucceeded: result.perSet.filter((set) => set.blockedItems === 0 && set.conflicts === 0).length, setsBlocked: blocked.filter((item) => item.classification !== 'manual_review').length, setsManualReview: blocked.filter((item) => item.classification === 'manual_review').length, expectedCardsTotal: result.perSet.reduce((sum, set) => sum + set.expectedCards, 0), receivedCardsTotal: result.perSet.reduce((sum, set) => sum + set.receivedCards, 0), catalogInserts: result.perSet.reduce((sum, set) => sum + set.plannedCatalogInserts, 0), referenceInserts: result.perSet.reduce((sum, set) => sum + set.plannedReferenceInserts, 0), conflicts: conflicts.length, blockedReasonCodes: blocked.flatMap((item) => item.reasonCodes), prechecks: result.prechecks, postchecks: {}, operationalErrors: [], databaseWritesTotal: 0, checkpointStatus: 'complete', analysis, finalStatus: conflicts.length === 0 && result.perSet.every((set) => set.receivedCards === set.expectedCards && set.blockedItems === 0) ? 'PASS' : 'BLOCKED' };
  draft.reportHash = reportHash(draft);
  const plan = sealWriteplan({ schemaVersion: 1, phase: REMAINING_PHASE, source: 'pokemon_tcg_data', datasetRepository: POKEMON_TCG_DATA_REPOSITORY, datasetVersion: PINNED_DATASET_VERSION, datasetCommit: PINNED_DATASET_VERSION, manifestHash: result.manifestHash, analysisHash: aHash, batch: REMAINING_BATCH, sets: result.perSet.map((set) => set.setId), perSet: result.perSet.map((set) => ({ setId: set.setId, expectedCards: set.expectedCards, actions: set.actions.map((action: any) => action.referenceInsert ? { ...action, referenceInsert: { id: deterministicCatalogCardUuid('card_external_reference', `pokemon_tcg_api:${action.externalId}`), ...action.referenceInsert } } : action) })), blockedItems: blocked, conflicts, totals: { expectedCards: draft.expectedCardsTotal, catalogInserts: draft.catalogInserts, referenceInserts: draft.referenceInserts }, sourceReportHash: draft.reportHash, finalStatus: draft.finalStatus });
  writeAtomicJson(options.checkpoint, { identity: aHash, completedChunks: [], writes: 0 }); writeAtomicJson(options.writeplan, plan); writeAtomicJson(options.report, draft);
}

async function writeApproved(options: Options, db: SupabaseClient): Promise<void> {
  const report = JSON.parse(readFileSync(options.approvedReport!, 'utf8')); const plan = JSON.parse(readFileSync(options.writeplan, 'utf8')) as RemainingWritePlan;
  const { manifestHash } = localManifestIdentityFromText(readFileSync(options.manifest, 'utf8')); validateLocalDatasetCheckout(options.dataset, PINNED_DATASET_VERSION); validateApprovedArtifacts({ report, plan, manifestHash, datasetCommit: PINNED_DATASET_VERSION });
  const before = await counts(db); const actions = plan.perSet.flatMap((set) => set.actions as any[]).filter((action) => action.action === 'insertCardAndReference' || action.action === 'insertReference'); const chunks = Array.from({ length: Math.ceil(actions.length / options.chunkSize) }, (_, index) => actions.slice(index * options.chunkSize, (index + 1) * options.chunkSize));
  let checkpoint: ResumeCheckpoint = options.resume ? JSON.parse(readFileSync(options.checkpoint, 'utf8')) : { identity: plan.writeplanHash!, completedChunks: [], writes: 0 };
  for (const index of resumeChunks(chunks.length, checkpoint, plan.writeplanHash!)) { const chunk = chunks[index]; const cards = chunk.filter((item) => item.action === 'insertCardAndReference').map((item) => item.catalogInsert); const references = chunk.map((item) => item.referenceInsert); if (cards.length) { const { error } = await db.from('cards_catalog').insert(cards); if (error) throw new Error(`catalog_chunk_failed:${index}`); } if (references.length) { const { error } = await db.from('card_external_references').insert(references); if (error) throw new Error(`reference_chunk_failed:${index}`); } checkpoint = { ...checkpoint, completedChunks: [...checkpoint.completedChunks, index].sort((a, b) => a - b), writes: checkpoint.writes + cards.length + references.length }; writeAtomicJson(options.checkpoint, checkpoint); const now = await counts(db); assertNoUnexpectedWrites(checkpoint.writes, (now.cards_catalog - before.cards_catalog) + (now.card_external_references - before.card_external_references)); }
  const after = await counts(db); assertNoUnexpectedWrites(checkpoint.writes, (after.cards_catalog - before.cards_catalog) + (after.card_external_references - before.card_external_references)); assertIdempotent(0); const final = { ...report, mode: 'write-approved', prechecks: before, postchecks: after, databaseWritesTotal: checkpoint.writes, checkpointStatus: 'complete' }; final.reportHash = reportHash(final); writeAtomicJson(options.report, final);
}

export async function main(argv = process.argv.slice(2)): Promise<void> { const options = parseRemainingBulkArgs(argv); const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.'); const db = createClient(url, key); if (options.mode === 'dry-run') await dryRun(options, db); else await writeApproved(options, db); }
if (process.argv[1]?.endsWith('import-remaining-bulk.ts') && !process.env.NODE_TEST_CONTEXT) main().catch((error) => { console.error(error instanceof Error ? error.message : 'bulk_failure'); process.exitCode = 1; });
