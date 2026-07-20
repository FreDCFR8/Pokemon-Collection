import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createExceptionScope } from '../../scripts/catalog/phase-7b-exception-audit.ts';

const manifest = JSON.parse(readFileSync('config/catalog/local-pokemon-tcg-data-manifest.json', 'utf8'));
const review = JSON.parse(readFileSync('config/catalog/remaining-set-catalog-mapping-review.json', 'utf8'));
const source = readFileSync('scripts/catalog/phase-7b-exception-audit.ts', 'utf8');

test('exception audit has the exact 18-set scope and preserves svp plus all review exclusions', () => {
  const scope = createExceptionScope(manifest, review);
  assert.equal(scope.length, 18);
  assert.equal(scope.some((set) => set.setId === 'svp'), true);
  assert.equal(scope.filter((set) => set.reviewReason?.startsWith('manual_review')).map((set) => set.setId).join(','), 'cel25c,zsv10pt5');
});

test('exception audit rejects changed dataset or excluded-set identity', () => {
  assert.throws(() => createExceptionScope({ ...manifest, datasetVersion: 'wrong' }, review), /Manifestidentiteit/);
  assert.throws(() => createExceptionScope(manifest, { ...review, excludedSets: review.excludedSets.slice(0, 16) }), /Reviewidentiteit/);
});

test('exception audit is read-only and has no write-shaped Supabase operations', () => {
  assert.match(source, /databaseWritesTotal: 0/);
  assert.doesNotMatch(source, /\.(insert|update|upsert|delete|rpc)\s*\(/);
  assert.doesNotMatch(source, /--mode|confirm-write|approved-report/);
});
