const WRITE_ALLOWED_SET_IDS = new Set(['sv3pt5', 'sv3']);
export const MAX_SET_ID_LENGTH = 32;

export type CatalogImportOptions = { setId: string; write: boolean };

export class CatalogImportArgumentError extends Error {}

export function getWritePlanTitle(write: boolean): string {
  return write ? 'Goedgekeurd writeplan (WRITE)' : 'Theoretisch writeplan (read-only analyse)';
}

export function isValidSetId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_SET_ID_LENGTH && /^[a-z0-9]+$/.test(value);
}

export function parseCatalogImportArgs(argv: readonly string[]): CatalogImportOptions {
  let setId: string | undefined;
  let write = false;

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

    if (arg === '--write') {
      if (write) throw new CatalogImportArgumentError('--write mag slechts eenmaal worden opgegeven.');
      write = true;
      continue;
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

  return { setId, write };
}

export function assertWriteAuthorized(options: CatalogImportOptions): void {
  if (!options.write) return;
  if (!WRITE_ALLOWED_SET_IDS.has(options.setId)) {
    throw new CatalogImportArgumentError(
      `Write geblokkeerd: set ${options.setId} staat niet op de expliciete write-allowlist. Alleen sv3pt5 en sv3 zijn geautoriseerd.`,
    );
  }
}
