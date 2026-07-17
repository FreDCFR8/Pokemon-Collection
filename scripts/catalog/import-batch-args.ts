import { isValidSetId } from './import-args.ts';

export const DEFAULT_CATALOG_BATCH_CONFIG_PATH = 'config/catalog/import-sets.json';

export type CatalogBatchMode = 'dry-run' | 'write-approved';

export type CatalogBatchOptions = {
  mode: CatalogBatchMode;
  configPath: string;
  setIds?: string[];
};

export type CatalogBatchConfig = {
  source: 'pokemon_tcg_api';
  sets: string[];
};

export class CatalogBatchArgumentError extends Error {}

function parseSetList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertValidSetList(setIds: readonly string[], label: string): void {
  if (setIds.length === 0) throw new CatalogBatchArgumentError(`${label} bevat geen set-ID's.`);
  const seen = new Set<string>();
  for (const setId of setIds) {
    if (!isValidSetId(setId)) {
      throw new CatalogBatchArgumentError(`Ongeldige set-ID in ${label}: ${setId}. Gebruik alleen lowercase ASCII-letters en cijfers.`);
    }
    if (seen.has(setId)) throw new CatalogBatchArgumentError(`Dubbele set-ID in ${label}: ${setId}.`);
    seen.add(setId);
  }
}

export function parseCatalogBatchArgs(argv: readonly string[]): CatalogBatchOptions {
  let mode: CatalogBatchMode = 'dry-run';
  let configPath = DEFAULT_CATALOG_BATCH_CONFIG_PATH;
  let setIds: string[] | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--mode') {
      const value = argv[index + 1];
      if (value !== 'dry-run' && value !== 'write-approved') {
        throw new CatalogBatchArgumentError('Ongeldige of ontbrekende waarde voor --mode. Gebruik dry-run of write-approved.');
      }
      mode = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      const value = arg.slice('--mode='.length);
      if (value !== 'dry-run' && value !== 'write-approved') {
        throw new CatalogBatchArgumentError('Ongeldige waarde voor --mode. Gebruik dry-run of write-approved.');
      }
      mode = value;
      continue;
    }

    if (arg === '--config') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new CatalogBatchArgumentError('Ontbrekende waarde voor --config.');
      configPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--config=')) {
      configPath = arg.slice('--config='.length);
      if (!configPath) throw new CatalogBatchArgumentError('Ontbrekende waarde voor --config.');
      continue;
    }

    if (arg === '--sets') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new CatalogBatchArgumentError('Ontbrekende waarde voor --sets.');
      if (setIds !== undefined) throw new CatalogBatchArgumentError('--sets mag slechts eenmaal worden opgegeven.');
      setIds = parseSetList(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--sets=')) {
      if (setIds !== undefined) throw new CatalogBatchArgumentError('--sets mag slechts eenmaal worden opgegeven.');
      setIds = parseSetList(arg.slice('--sets='.length));
      continue;
    }

    throw new CatalogBatchArgumentError(`Onbekend argument: ${arg}`);
  }

  if (setIds !== undefined) assertValidSetList(setIds, '--sets');
  return { mode, configPath, ...(setIds ? { setIds } : {}) };
}

export function parseCatalogBatchConfigFromText(text: string): CatalogBatchConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CatalogBatchArgumentError('Batchconfig is geen geldige JSON.');
  }

  if (!parsed || typeof parsed !== 'object') throw new CatalogBatchArgumentError('Batchconfig heeft een ongeldig formaat.');
  const config = parsed as { source?: unknown; sets?: unknown };
  if (config.source !== 'pokemon_tcg_api') throw new CatalogBatchArgumentError('Batchconfig moet source pokemon_tcg_api gebruiken.');
  if (!Array.isArray(config.sets) || !config.sets.every((setId) => typeof setId === 'string')) {
    throw new CatalogBatchArgumentError('Batchconfig moet een sets-array met set-ID strings bevatten.');
  }
  assertValidSetList(config.sets, 'batchconfig');
  return { source: 'pokemon_tcg_api', sets: config.sets };
}
