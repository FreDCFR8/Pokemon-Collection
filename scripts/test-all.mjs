import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

async function findTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await findTestFiles(path)));
    else if (entry.isFile() && entry.name.endsWith('.test.ts')) files.push(path);
  }
  return files;
}

const testFiles = (await findTestFiles(resolve('tests'))).sort();
if (testFiles.length === 0) {
  console.error('No .test.ts files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...testFiles], { stdio: 'inherit' });
process.exit(result.status ?? 1);
