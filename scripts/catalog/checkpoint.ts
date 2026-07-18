import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';

export const CHECKPOINT_SCHEMA_VERSION = 1;
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
};

export type CatalogBatchCheckpoint = CheckpointIdentity & {
  startedAt: string;
  updatedAt: string;
  sets: CheckpointSet[];
};

export class CheckpointError extends Error {}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function supabaseProjectIdentity(urlValue: string | undefined): string {
  if (!urlValue) return 'missing';
  try {
    const url = new URL(urlValue);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return 'invalid';
  }
}

export function writeAtomicJson(path: string, value: unknown): void {
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(tempPath, path);
  } finally {
    try { unlinkSync(tempPath); } catch {}
  }
}

export function readCheckpoint(path: string): CatalogBatchCheckpoint {
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new CheckpointError(`Checkpoint kan niet als JSON worden gelezen: ${path}`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new CheckpointError('Checkpoint heeft een ongeldig formaat.');
  const value = parsed as Partial<CatalogBatchCheckpoint>;
  if (value.checkpointSchemaVersion !== CHECKPOINT_SCHEMA_VERSION) throw new CheckpointError(`Checkpoint-schema ${String(value.checkpointSchemaVersion)} wordt niet ondersteund; verwacht ${CHECKPOINT_SCHEMA_VERSION}.`);
  if (value.source !== 'pokemon_tcg_data' || value.mode !== 'dry-run') throw new CheckpointError('Checkpoint source/mode komt niet overeen met de lokale dry-run.');
  if (!Array.isArray(value.sets) || value.sets.some((set) => !set || typeof set !== 'object')) throw new CheckpointError('Checkpoint bevat geen geldige sets-array.');
  return value as CatalogBatchCheckpoint;
}

export function assertCheckpointIdentity(checkpoint: CheckpointIdentity, current: CheckpointIdentity): void {
  const fields: (keyof CheckpointIdentity)[] = ['checkpointSchemaVersion', 'source', 'mode', 'datasetRepository', 'datasetVersion', 'manifestHash', 'supabaseProjectIdentity'];
  const mismatches = fields.filter((field) => checkpoint[field] !== current[field]).map((field) => `Checkpoint mismatch voor ${field}: checkpoint=${String(checkpoint[field])}, actuele run=${String(current[field])}.`);
  if (JSON.stringify(checkpoint.setIds) !== JSON.stringify(current.setIds)) mismatches.push(`Checkpoint mismatch voor setselectie: checkpoint=${JSON.stringify(checkpoint.setIds)}, actuele run=${JSON.stringify(current.setIds)}.`);
  if (mismatches.length > 0) throw new CheckpointError(mismatches.join(' '));
}

export function checkpointExists(path: string): boolean { return existsSync(path); }
