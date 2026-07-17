const WRITE_ALLOWED_SET_IDS = new Set(['sv3pt5', 'sv3']);
export const MAX_SET_ID_LENGTH = 32;

export type CatalogImportSource = 'pokemon_tcg_api' | 'pokemon_tcg_data';
export type CatalogImportOptions = {
  setId: string;
  write: boolean;
  source: CatalogImportSource;
  inputPath?: string;
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
  let inputPath: string | undefined;

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
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new CatalogImportArgumentError('Ontbrekende waarde voor --source.');
      }
      source = parseSource(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--source=')) {
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
  if (source === 'pokemon_tcg_data' && inputPath === undefined) {
    throw new CatalogImportArgumentError('Bron pokemon_tcg_data vereist --input naar een lokaal set-JSON-bestand.');
  }
  if (source === 'pokemon_tcg_api' && inputPath !== undefined) {
    throw new CatalogImportArgumentError('--input is alleen toegestaan met bron pokemon_tcg_data.');
  }

  return { setId, write, source, inputPath };
}

export function assertWriteAuthorized(options: CatalogImportOptions): void {
  if (!options.write) return;
  if (options.source !== 'pokemon_tcg_api') {
    throw new CatalogImportArgumentError('Write geblokkeerd: lokale JSON-bron is in deze fase read-only. Gebruik eerst een dry-run met --source pokemon_tcg_data.');
  }
  if (!WRITE_ALLOWED_SET_IDS.has(options.setId)) {
    throw new CatalogImportArgumentError(
      `Write geblokkeerd: set ${options.setId} staat niet op de expliciete write-allowlist. Alleen sv3pt5 en sv3 zijn geautoriseerd.`,
    );
  }
}
