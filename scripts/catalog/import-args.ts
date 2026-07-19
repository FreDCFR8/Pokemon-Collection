const WRITE_ALLOWED_SET_IDS = new Set(['sv3pt5', 'sv3']);
export const MAX_SET_ID_LENGTH = 32;

export type CatalogImportSource = 'pokemon_tcg_api' | 'pokemon_tcg_data';
export type CatalogBatchApproval = 'batch-1' | 'batch-2' | 'batch-3';
export type CatalogImportOptions = {
  setId: string;
  write: boolean;
  source: CatalogImportSource;
  inputPath?: string;
  diagnosticResultPath?: string;
  writePlanPath?: string;
  idempotency?: boolean;
  reconcile?: boolean;
  setName?: string;
  setSeries?: string;
  batchApproval?: CatalogBatchApproval;
};

export class CatalogImportArgumentError extends Error {}

export function getWritePlanTitle(write: boolean): string {
  return write ? 'Goedgekeurd writeplan (WRITE)' : 'Theoretisch writeplan (read-only analyse)';
}

export function isValidSetId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_SET_ID_LENGTH && /^[a-z0-9]+$/.test(value);
}

function parseSource(value: string): CatalogImportSource {
  if (value === 'pokemon_tcg_api' || value === 'pokemon_tcg_data') return value;
  throw new CatalogImportArgumentError('Ongeldige bron. Gebruik pokemon_tcg_api of pokemon_tcg_data.');
}

export function parseCatalogImportArgs(argv: readonly string[]): CatalogImportOptions {
  let setId: string | undefined;
  let write = false;
  let source: CatalogImportSource = 'pokemon_tcg_api';
  let sourceSpecified = false;
  let inputPath: string | undefined;
  let diagnosticResultPath: string | undefined;
  let writePlanPath: string | undefined;
  let idempotency = false;
  let reconcile = false;
  let setName: string | undefined;
  let setSeries: string | undefined;
  let batchApproval: CatalogBatchApproval | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--set') {
      if (setId !== undefined) throw new CatalogImportArgumentError('--set mag slechts eenmaal worden opgegeven.');
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new CatalogImportArgumentError('Ontbrekende waarde voor --set. Gebruik: npm run catalog:import -- --set sv3pt5');
      }
      setId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--set=')) {
      if (setId !== undefined) throw new CatalogImportArgumentError('--set mag slechts eenmaal worden opgegeven.');
      setId = arg.slice('--set='.length);
      continue;
    }

    if (arg === '--source') {
      if (sourceSpecified) throw new CatalogImportArgumentError('--source mag slechts eenmaal worden opgegeven.');
      sourceSpecified = true;
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new CatalogImportArgumentError('Ontbrekende waarde voor --source.');
      }
      source = parseSource(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--source=')) {
      if (sourceSpecified) throw new CatalogImportArgumentError('--source mag slechts eenmaal worden opgegeven.');
      sourceSpecified = true;
      source = parseSource(arg.slice('--source='.length));
      continue;
    }

    if (arg === '--input') {
      if (inputPath !== undefined) throw new CatalogImportArgumentError('--input mag slechts eenmaal worden opgegeven.');
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new CatalogImportArgumentError('Ontbrekende waarde voor --input.');
      }
      inputPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--input=')) {
      if (inputPath !== undefined) throw new CatalogImportArgumentError('--input mag slechts eenmaal worden opgegeven.');
      inputPath = arg.slice('--input='.length);
      continue;
    }

    if (arg === '--diagnostic-result') {
      if (diagnosticResultPath !== undefined) throw new CatalogImportArgumentError('--diagnostic-result mag slechts eenmaal worden opgegeven.');
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new CatalogImportArgumentError('Ontbrekende waarde voor --diagnostic-result.');
      diagnosticResultPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--diagnostic-result=')) {
      if (diagnosticResultPath !== undefined) throw new CatalogImportArgumentError('--diagnostic-result mag slechts eenmaal worden opgegeven.');
      diagnosticResultPath = arg.slice('--diagnostic-result='.length);
      if (!diagnosticResultPath) throw new CatalogImportArgumentError('Ontbrekende waarde voor --diagnostic-result.');
      continue;
    }

    if (arg === '--set-name' || arg === '--set-series') {
      const key = arg === '--set-name' ? 'name' : 'series';
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new CatalogImportArgumentError(`Ontbrekende waarde voor ${arg}.`);
      if (key === 'name') { if (setName !== undefined) throw new CatalogImportArgumentError('--set-name mag slechts eenmaal worden opgegeven.'); setName = value; }
      else { if (setSeries !== undefined) throw new CatalogImportArgumentError('--set-series mag slechts eenmaal worden opgegeven.'); setSeries = value; }
      index += 1;
      continue;
    }

    if (arg.startsWith('--set-name=') || arg.startsWith('--set-series=')) {
      const isName = arg.startsWith('--set-name=');
      const value = arg.slice(isName ? '--set-name='.length : '--set-series='.length);
      if (!value) throw new CatalogImportArgumentError(`Ontbrekende waarde voor ${isName ? '--set-name' : '--set-series'}.`);
      if (isName) { if (setName !== undefined) throw new CatalogImportArgumentError('--set-name mag slechts eenmaal worden opgegeven.'); setName = value; }
      else { if (setSeries !== undefined) throw new CatalogImportArgumentError('--set-series mag slechts eenmaal worden opgegeven.'); setSeries = value; }
      continue;
    }

    if (arg === '--write') {
      if (write) throw new CatalogImportArgumentError('--write mag slechts eenmaal worden opgegeven.');
      write = true;
      continue;
    }

    if (arg === '--idempotency') {
      if (idempotency) throw new CatalogImportArgumentError('--idempotency mag slechts eenmaal worden opgegeven.');
      idempotency = true;
      continue;
    }

    if (arg === '--reconcile') {
      if (reconcile) throw new CatalogImportArgumentError('--reconcile mag slechts eenmaal worden opgegeven.');
      reconcile = true;
      continue;
    }

    if (arg === '--write-plan') {
      if (writePlanPath !== undefined) throw new CatalogImportArgumentError('--write-plan mag slechts eenmaal worden opgegeven.');
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new CatalogImportArgumentError('Ontbrekende waarde voor --write-plan.');
      writePlanPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--write-plan=')) {
      if (writePlanPath !== undefined) throw new CatalogImportArgumentError('--write-plan mag slechts eenmaal worden opgegeven.');
      writePlanPath = arg.slice('--write-plan='.length);
      if (!writePlanPath) throw new CatalogImportArgumentError('Ontbrekende waarde voor --write-plan.');
      continue;
    }

    if (arg === '--batch-approval') {
      if (batchApproval) throw new CatalogImportArgumentError('--batch-approval mag slechts eenmaal worden opgegeven.');
      const value = argv[index + 1];
      if (value !== 'batch-1' && value !== 'batch-2' && value !== 'batch-3') throw new CatalogImportArgumentError('--batch-approval vereist batch-1, batch-2 of batch-3.');
      batchApproval = value; index += 1; continue;
    }

    if (arg.startsWith('--write=')) {
      throw new CatalogImportArgumentError('Ongeldige --write-variant. Alleen het exacte argument --write is toegestaan.');
    }

    throw new CatalogImportArgumentError(`Onbekend argument: ${arg}`);
  }

  if (setId === undefined) {
    throw new CatalogImportArgumentError('Verplicht argument ontbreekt: --set. Gebruik: npm run catalog:import -- --set sv3pt5');
  }
  if (!isValidSetId(setId)) {
    throw new CatalogImportArgumentError('Ongeldige set-ID. Gebruik alleen lowercase ASCII-letters en cijfers met een redelijke lengte.');
  }
  if (source === 'pokemon_tcg_data' && inputPath === undefined) {
    throw new CatalogImportArgumentError('Bron pokemon_tcg_data vereist --input naar een lokaal set-JSON-bestand.');
  }
  if (source === 'pokemon_tcg_data' && (!setName || !setSeries)) throw new CatalogImportArgumentError('Bron pokemon_tcg_data vereist officiële --set-name en --set-series uit het manifest.');
  if (source === 'pokemon_tcg_api' && (setName !== undefined || setSeries !== undefined)) throw new CatalogImportArgumentError('--set-name en --set-series zijn alleen toegestaan met bron pokemon_tcg_data.');
  if (source === 'pokemon_tcg_api' && inputPath !== undefined) {
    throw new CatalogImportArgumentError('--input is alleen toegestaan met bron pokemon_tcg_data.');
  }

  if (idempotency && (write || source !== 'pokemon_tcg_data')) throw new CatalogImportArgumentError('--idempotency is alleen toegestaan voor lokale read-only idempotency.');
  if (idempotency && !writePlanPath) throw new CatalogImportArgumentError('--idempotency vereist --write-plan.');
  if (reconcile && (!write || source !== 'pokemon_tcg_data')) throw new CatalogImportArgumentError('--reconcile is alleen toegestaan voor lokale write-approved uitvoer.');
  if (reconcile && !writePlanPath) throw new CatalogImportArgumentError('--reconcile vereist --write-plan.');
  if (writePlanPath && ((!write && !idempotency) || source !== 'pokemon_tcg_data')) throw new CatalogImportArgumentError('--write-plan is alleen toegestaan voor lokale write-approved of idempotency-uitvoer.');
  return { setId, write, source, ...(inputPath ? { inputPath } : {}), ...(diagnosticResultPath ? { diagnosticResultPath } : {}), ...(writePlanPath ? { writePlanPath } : {}), ...(idempotency ? { idempotency } : {}), ...(reconcile ? { reconcile } : {}), ...(setName ? { setName } : {}), ...(setSeries ? { setSeries } : {}), ...(batchApproval ? { batchApproval } : {}) };
}

export function assertWriteAuthorized(options: CatalogImportOptions): void {
  if (!options.write) return;
  if (options.source !== 'pokemon_tcg_api') {
    if (!options.batchApproval) throw new CatalogImportArgumentError('Write geblokkeerd: lokale JSON-bron blijft read-only tenzij expliciete batchgoedkeuring aanwezig is.');
    return;
  }
  if (!WRITE_ALLOWED_SET_IDS.has(options.setId)) {
    throw new CatalogImportArgumentError(
      `Write geblokkeerd: set ${options.setId} staat niet op de expliciete write-allowlist. Alleen sv3pt5 en sv3 zijn geautoriseerd.`,
    );
  }
}
