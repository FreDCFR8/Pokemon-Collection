import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { isValidSetId } from './import-args.ts';
import { POKEMON_TCG_DATA_REPOSITORY } from './local-checkout.ts';
import { assertValidDiagnosticResult, type SingleSetDiagnosticResult } from './diagnostic-result.ts';

export const CHECKPOINT_SCHEMA_VERSION = 2;
export type CheckpointSetStatus = 'pending' | 'running' | 'passed' | 'failed';

export type CheckpointIdentity = {
  checkpointSchemaVersion: number;
  source: 'pokemon_tcg_data';
  mode: 'dry-run';
  datasetRepository: string;
  datasetVersion: string;
  manifestHash: string;
  setIds: string[];
  supabaseProjectIdentity: string;
};

export type CheckpointSet = {
  setId: string;
  expectedCards: number;
  status: CheckpointSetStatus;
  receivedCards?: number;
  plannedWrites?: number;
  databaseWrites?: number;
  error?: string;
  diagnostic?: SingleSetDiagnosticResult;
};

export type CatalogBatchCheckpoint = CheckpointIdentity & {
  startedAt: string;
  updatedAt: string;
  sets: CheckpointSet[];
};

export class CheckpointError extends Error {}

export type AtomicJsonDependencies = {
  writeFile?: typeof writeFileSync;
  renameFile?: typeof renameSync;
  unlinkFile?: typeof unlinkSync;
  tempPath?: (path: string) => string;
};

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function supabaseProjectIdentity(urlValue: string | undefined): string {
  if (!urlValue) throw new CheckpointError('SUPABASE_URL ontbreekt; een lokale batch vereist een geldige HTTP(S)-URL.');
  let url: URL;
  try { url = new URL(urlValue); } catch { throw new CheckpointError('SUPABASE_URL is ongeldig; gebruik een volledige HTTP(S)-URL.'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new CheckpointError('SUPABASE_URL moet een HTTP(S)-URL zijn.');
  if (!url.hostname || url.username || url.password) throw new CheckpointError('SUPABASE_URL bevat geen bruikbare projectidentiteit.');
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, '')}`;
}

export function writeAtomicJson(path: string, value: unknown, dependencies: AtomicJsonDependencies = {}): void {
  const tempPath = dependencies.tempPath?.(path) ?? `${path}.tmp-${process.pid}-${Date.now()}`;
  const writeFile = dependencies.writeFile ?? writeFileSync;
  const renameFile = dependencies.renameFile ?? renameSync;
  const unlinkFile = dependencies.unlinkFile ?? unlinkSync;
  try {
    writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameFile(tempPath, path);
  } finally {
    try { unlinkFile(tempPath); } catch {}
  }
}

export function readCheckpoint(path: string): CatalogBatchCheckpoint {
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new CheckpointError(`Checkpoint kan niet als JSON worden gelezen: ${path}`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new CheckpointError('Checkpoint heeft een ongeldig formaat.');
  const value = parsed as Record<string, unknown>;
  const allowedKeys = new Set(['checkpointSchemaVersion', 'source', 'mode', 'datasetRepository', 'datasetVersion', 'manifestHash', 'setIds', 'supabaseProjectIdentity', 'startedAt', 'updatedAt', 'sets']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) throw new CheckpointError('Checkpoint bevat onbekende velden.');
  if (value.checkpointSchemaVersion !== CHECKPOINT_SCHEMA_VERSION) throw new CheckpointError(`Checkpoint-schema is ongeldig; verwacht ${CHECKPOINT_SCHEMA_VERSION}.`);
  if (value.source !== 'pokemon_tcg_data' || value.mode !== 'dry-run') throw new CheckpointError('Checkpoint source/mode komt niet overeen met de lokale dry-run.');
  if (value.datasetRepository !== POKEMON_TCG_DATA_REPOSITORY) throw new CheckpointError('Checkpoint datasetRepository komt niet overeen met pokemon_tcg_data.');
  if (typeof value.datasetVersion !== 'string' || !/^[0-9a-f]{40}$/.test(value.datasetVersion)) throw new CheckpointError('Checkpoint datasetVersion moet een lowercase Git-SHA van 40 tekens zijn.');
  if (typeof value.manifestHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.manifestHash)) throw new CheckpointError('Checkpoint manifestHash moet een lowercase SHA-256 van 64 tekens zijn.');
  if (typeof value.supabaseProjectIdentity !== 'string') throw new CheckpointError('Checkpoint mist een geldige Supabase-projectidentiteit.');
  const identity = supabaseProjectIdentity(value.supabaseProjectIdentity);
  if (identity !== value.supabaseProjectIdentity) throw new CheckpointError('Checkpoint Supabase-projectidentiteit is niet genormaliseerd.');
  if (!isIsoTimestamp(value.startedAt) || !isIsoTimestamp(value.updatedAt)) throw new CheckpointError('Checkpoint startedAt en updatedAt moeten geldige ISO-timestamps zijn.');
  if (!Array.isArray(value.setIds) || value.setIds.length === 0 || value.setIds.some((setId) => typeof setId !== 'string' || !isValidSetId(setId))) throw new CheckpointError('Checkpoint setIds bevat ongeldige set-ID\'s.');
  if (new Set(value.setIds).size !== value.setIds.length) throw new CheckpointError('Checkpoint setIds bevat dubbele set-ID\'s.');
  if (!Array.isArray(value.sets) || value.sets.length !== value.setIds.length) throw new CheckpointError('Checkpoint sets moet exact één entry per setId bevatten.');
  const sets = value.sets.map((set, index) => validateCheckpointSet(set, index));
  if (sets.some((set, index) => set.setId !== value.setIds[index])) throw new CheckpointError('Checkpoint setvolgorde komt niet overeen met setIds.');
  return { checkpointSchemaVersion: CHECKPOINT_SCHEMA_VERSION, source: 'pokemon_tcg_data', mode: 'dry-run', datasetRepository: POKEMON_TCG_DATA_REPOSITORY, datasetVersion: value.datasetVersion, manifestHash: value.manifestHash, setIds: [...value.setIds], supabaseProjectIdentity: value.supabaseProjectIdentity, startedAt: value.startedAt as string, updatedAt: value.updatedAt as string, sets };
}

function isIsoTimestamp(value: unknown): value is string { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }

function nonNegativeInteger(value: unknown): value is number { return Number.isInteger(value) && (value as number) >= 0; }

function validateCheckpointSet(value: unknown, index: number): CheckpointSet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CheckpointError(`Checkpoint set op positie ${index + 1} heeft een ongeldig formaat.`);
  const set = value as Record<string, unknown>;
  const allowedFields = new Set(['setId', 'expectedCards', 'status', 'receivedCards', 'plannedWrites', 'databaseWrites', 'error', 'diagnostic']);
  const unknownFields = Object.keys(set).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) throw new CheckpointError(`Checkpoint set ${String(set.setId ?? '?')} bevat onbekende velden: ${unknownFields.join(', ')}.`);
  if (typeof set.setId !== 'string' || !isValidSetId(set.setId)) throw new CheckpointError(`Checkpoint set op positie ${index + 1} heeft een ongeldige set-ID.`);
  if (!nonNegativeInteger(set.expectedCards) || set.expectedCards === 0) throw new CheckpointError(`Checkpoint set ${set.setId} heeft een ongeldig expectedCards-aantal.`);
  if (set.status !== 'pending' && set.status !== 'running' && set.status !== 'passed' && set.status !== 'failed') throw new CheckpointError(`Checkpoint set ${set.setId} heeft een onbekende status.`);
  for (const field of ['receivedCards', 'plannedWrites', 'databaseWrites'] as const) if (set[field] !== undefined && !nonNegativeInteger(set[field])) throw new CheckpointError(`Checkpoint set ${set.setId} heeft een ongeldige teller ${field}.`);
  if (set.error !== undefined && (typeof set.error !== 'string' || set.error.length === 0)) throw new CheckpointError(`Checkpoint set ${set.setId} heeft een ongeldige foutclassificatie.`);
  if (set.status === 'pending' || set.status === 'running') {
    if (set.diagnostic !== undefined) throw new CheckpointError(`Checkpoint ${set.status}-set ${set.setId} mag geen diagnostiek bevatten.`);
  } else {
    if (set.diagnostic === undefined) throw new CheckpointError(`Checkpoint ${set.status}-set ${set.setId} vereist volledige diagnostiek.`);
    try { assertValidDiagnosticResult(set.diagnostic); } catch (error) { throw new CheckpointError(`Checkpoint diagnostiek voor ${set.setId} is ongeldig: ${error instanceof Error ? error.message : 'onbekende fout'}`); }
    if (set.diagnostic.setId !== set.setId || (set.status === 'passed' && (set.diagnostic.status !== 'PASS' || set.diagnostic.failureReasons.length > 0)) || (set.status === 'failed' && set.diagnostic.status !== 'FAIL')) throw new CheckpointError(`Checkpoint diagnostiek/status van ${set.setId} komt niet overeen.`);
  }
  if (set.status === 'passed' && (set.error !== undefined || !nonNegativeInteger(set.receivedCards) || !nonNegativeInteger(set.plannedWrites) || !nonNegativeInteger(set.databaseWrites) || set.receivedCards !== set.expectedCards || set.databaseWrites !== 0)) throw new CheckpointError(`Checkpoint passed-set ${set.setId} mist geldige tellers of heeft databaseWrites groter dan nul.`);
  return { setId: set.setId, expectedCards: set.expectedCards, status: set.status, ...(set.receivedCards !== undefined ? { receivedCards: set.receivedCards } : {}), ...(set.plannedWrites !== undefined ? { plannedWrites: set.plannedWrites } : {}), ...(set.databaseWrites !== undefined ? { databaseWrites: set.databaseWrites } : {}), ...(set.error !== undefined ? { error: set.error } : {}), ...(set.diagnostic !== undefined ? { diagnostic: set.diagnostic as SingleSetDiagnosticResult } : {}) };
}

export function assertCheckpointIdentity(checkpoint: CatalogBatchCheckpoint, current: CheckpointIdentity, expectedSets: readonly { setId: string; expectedCards: number }[]): void {
  const fields: (keyof CheckpointIdentity)[] = ['checkpointSchemaVersion', 'source', 'mode', 'datasetRepository', 'datasetVersion', 'manifestHash', 'supabaseProjectIdentity'];
  const mismatches = fields.filter((field) => checkpoint[field] !== current[field]).map((field) => `Checkpoint mismatch voor ${field}: checkpoint=${String(checkpoint[field])}, actuele run=${String(current[field])}.`);
  if (JSON.stringify(checkpoint.setIds) !== JSON.stringify(current.setIds)) mismatches.push(`Checkpoint mismatch voor setselectie: checkpoint=${JSON.stringify(checkpoint.setIds)}, actuele run=${JSON.stringify(current.setIds)}.`);
  if (checkpoint.sets.length !== expectedSets.length) mismatches.push(`Checkpoint mismatch voor sets: checkpoint bevat ${checkpoint.sets.length}, actuele selectie bevat ${expectedSets.length}.`);
  for (let index = 0; index < Math.max(checkpoint.sets.length, expectedSets.length); index += 1) {
    const saved = checkpoint.sets[index]; const currentSet = expectedSets[index];
    if (saved && currentSet && saved.setId !== currentSet.setId) mismatches.push(`Checkpoint mismatch voor setvolgorde op positie ${index + 1}: checkpoint=${saved.setId}, actuele run=${currentSet.setId}.`);
    if (saved && currentSet && saved.expectedCards !== currentSet.expectedCards) mismatches.push(`Checkpoint mismatch voor expectedCards van ${currentSet.setId}: checkpoint=${saved.expectedCards}, actuele run=${currentSet.expectedCards}.`);
  }
  if (mismatches.length > 0) throw new CheckpointError(mismatches.join(' '));
}

export function checkpointExists(path: string): boolean { return existsSync(path); }
