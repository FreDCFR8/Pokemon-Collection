import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export const POKEMON_TCG_DATA_REPOSITORY = 'PokemonTCG/pokemon-tcg-data';
export const PINNED_DATASET_VERSION = '0af6250a22495e4a3e9f60ff45fc3fedc2e0563d';

export type GitRunner = (inputRoot: string, args: string[]) => string;

export class LocalDatasetCheckoutError extends Error {}

function git(inputRoot: string, args: string[]): string {
  const binary = process.env.CATALOG_GIT_BINARY ?? 'git';
  return execFileSync(binary, ['-C', inputRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...(binary.endsWith('.cmd') ? { shell: true } : {}) }).trim();
}

function normalizeOrigin(value: string): string {
  const normalized = value.trim().replace(/\.git$/, '');
  if (normalized.startsWith('git@github.com:')) return `https://github.com/${normalized.slice('git@github.com:'.length)}`;
  if (normalized.startsWith('ssh://git@github.com/')) return `https://github.com/${normalized.slice('ssh://git@github.com/'.length)}`;
  return normalized;
}

export function validateLocalDatasetCheckout(inputRoot: string, runGit: GitRunner = git): void {
  if (!existsSync(inputRoot)) throw new LocalDatasetCheckoutError(`input-root bestaat niet: ${inputRoot}`);
  try {
    if (runGit(inputRoot, ['rev-parse', '--is-inside-work-tree']) !== 'true') throw new Error('geen Git-worktree');
    const origin = normalizeOrigin(runGit(inputRoot, ['remote', 'get-url', 'origin']));
    if (origin.toLowerCase() !== `https://github.com/${POKEMON_TCG_DATA_REPOSITORY.toLowerCase()}`) throw new Error(`origin verwijst naar ${origin}, verwacht ${POKEMON_TCG_DATA_REPOSITORY}`);
    const head = runGit(inputRoot, ['rev-parse', 'HEAD']);
    if (head !== PINNED_DATASET_VERSION) throw new Error(`HEAD is ${head}, verwacht exact ${PINNED_DATASET_VERSION}`);
    if (runGit(inputRoot, ['status', '--porcelain=v1']) !== '') throw new Error('de dataset-worktree is niet schoon');
  } catch (error) {
    throw new LocalDatasetCheckoutError(`Ongeldige lokale dataset-checkout: ${error instanceof Error ? error.message : 'onbekende Git-fout'}`);
  }
}
