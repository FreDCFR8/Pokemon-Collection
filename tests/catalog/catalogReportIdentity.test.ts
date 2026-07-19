import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { analysisHash, analysisHashFromText, canonicalAnalysisJson, canonicalReportJson, reportHash, reportHashFromText } from '../../scripts/catalog/catalog-report-identity.ts';
import { validateApprovedDryRunReportText } from '../../scripts/catalog/import-batch.ts';
import { finalizeReport } from '../../scripts/catalog/rebaseline-read-only.ts';
import { reportHash as writeRunnerHash } from '../../scripts/catalog/setmapping-validation.ts';

const v2ReportPath = 'C:\\Users\\Freru\\AppData\\Local\\Temp\\pokemon-phase-7b-2f9e-b-batch-1-dry-run-v2.json';
const v4ReportPath = 'C:\\Users\\Freru\\AppData\\Local\\Temp\\pokemon-phase-7b-2f9e-b-batch-1-dry-run-v4.json';

test('JSON-roundtrip en LF/CRLF geven dezelfde reportHash', () => {
  const report = { z: 2, nested: { b: true, a: null }, items: [{ id: 'one' }, { id: 'two' }] };
  const lf = JSON.stringify(report, null, 2);
  assert.equal(reportHashFromText(lf), reportHashFromText(lf.replace(/\n/g, '\r\n')));
  assert.equal(reportHashFromText(lf), reportHash(JSON.parse(lf)));
});

test('reportHash wordt uitgesloten, maar arrays behouden hun betekenisvolle volgorde', () => {
  const report = { finalStatus: 'PASS', reportHash: 'a'.repeat(64), results: [{ setId: 'one' }, { setId: 'two' }] };
  assert.equal(reportHash(report), reportHash({ ...report, reportHash: 'b'.repeat(64) }));
  assert.notEqual(reportHash(report), reportHash({ ...report, results: [...report.results].reverse() }));
});

test('read-only en write-runner gebruiken exact dezelfde reportHash', () => {
  const report = { finalStatus: 'PASS', content: { count: 13 } };
  assert.equal(reportHash(report), writeRunnerHash(report));
  assert.notEqual(reportHash(report), reportHash({ ...report, content: { count: 14 } }));
  assert.equal(canonicalReportJson(report), '{"content":{"count":13},"finalStatus":"PASS"}');
});

test('v2 dry-runstructuur heeft de goedgekeurde reportHash', { skip: !existsSync(v2ReportPath) }, () => {
  const text = readFileSync(v2ReportPath, 'utf8');
  const report = JSON.parse(text) as Record<string, any>;
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.phase, 'Phase 7B-2F9E-B');
  assert.equal(report.source, 'pokemon_tcg_data');
  assert.equal(report.finalStatus, 'PASS');
  assert.equal(report.source, 'pokemon_tcg_data');
  assert.equal(report.databaseWritesTotal, 0);
  assert.equal(reportHashFromText(text), '405e6ca2e33b67ab45790adb7a0b1e75bf9f845220d9106195e4c3e848770fd2');
  assert.equal(reportHash(report), report.reportHash);
});

test('werkelijke v4 dry-runstructuur gebruikt dezelfde hash als de write-runner', { skip: !existsSync(v4ReportPath) }, () => {
  const text = readFileSync(v4ReportPath, 'utf8');
  const report = JSON.parse(text) as Record<string, any>;
  assert.deepEqual(Object.keys(report).sort(), [
    'actualWrites', 'blockedSets', 'checkpoint', 'conflicts', 'databaseWritesTotal', 'datasetRepository', 'datasetVersion',
    'expectedCardsTotal', 'finalStatus', 'finishedAt', 'importReadySets', 'manifestHash', 'operationalErrors', 'phase',
    'postcheckCounts', 'postcheckErrors', 'precheckCounts', 'reasonCodesBySet', 'receivedCardsTotal', 'reportHash', 'results',
    'schemaVersion', 'setsBlocked', 'setsNeedsManualReview', 'setsPassed', 'setsPlanned', 'setsProcessed', 'source', 'startedAt',
    'theoreticalWrites',
  ]);
  assert.equal(report.finalStatus, 'PASS');
  assert.equal(report.manifestHash, 'c5604ffa39e017e08eca089770bce82a786b1b20ebb45ee9bc0d6d22db3b6ab3');
  assert.equal(reportHashFromText(text), 'bbc5d9030882d574fb4e69a745a426d6a5f08cd0b810a775aec75f4591d85119');
  assert.equal(reportHash(report), report.reportHash);
});

test('volledige inhoudelijk gelijke rapporten met andere uitvoeringsvelden hebben dezelfde analysisHash', { skip: !existsSync(v4ReportPath) }, () => {
  const source = JSON.parse(readFileSync(v4ReportPath, 'utf8')) as Record<string, any>;
  const first = { ...source, startedAt: '2026-07-19T00:00:00.000Z', finishedAt: '2026-07-19T00:01:00.000Z', checkpoint: { path: 'first-checkpoint.json', resumed: false, skippedCompletedSets: 0 }, reportHash: 'a'.repeat(64) };
  const second = { ...source, startedAt: '2026-07-20T00:00:00.000Z', finishedAt: '2026-07-20T00:01:00.000Z', checkpoint: { path: 'second-checkpoint.json', resumed: true, skippedCompletedSets: 13 }, reportHash: 'b'.repeat(64) };
  assert.equal(analysisHash(first), analysisHash(second));
  assert.equal(analysisHashFromText(JSON.stringify(first)), analysisHash(first));
  assert.equal(canonicalAnalysisJson(first), canonicalAnalysisJson(second));
});

test('legacy read-only rapport zonder officiële batchconfiguratie wordt geblokkeerd', { skip: !existsSync(v4ReportPath) }, () => {
  const source = JSON.parse(readFileSync(v4ReportPath, 'utf8')) as Record<string, any>;
  const finalized = finalizeReport({ ...source, startedAt: '2026-07-19T02:00:00.000Z', finishedAt: '2026-07-19T02:01:00.000Z', checkpoint: { path: 'final-checkpoint.json', resumed: false, skippedCompletedSets: 0 } } as any);
  const path = join(tmpdir(), `pokemon-report-identity-e2e-${process.pid}.json`);
  try {
    writeFileSync(path, JSON.stringify(finalized));
    const fromDisk = readFileSync(path, 'utf8');
    assert.throws(() => validateApprovedDryRunReportText(fromDisk), /expectedImportReadySetCount/);
    assert.equal((JSON.parse(fromDisk) as Record<string, any>).databaseWritesTotal, 0);
  } finally {
    rmSync(path, { force: true });
  }
});

test('goedgekeurd dry-runrapport vereist exact pokemon_tcg_data als source', { skip: !existsSync(v4ReportPath) }, () => {
  const source = JSON.parse(readFileSync(v4ReportPath, 'utf8')) as Record<string, any>;
  for (const value of ['', 'pokemon_tcg_api']) {
    const changed = { ...source, source: value };
    changed.analysisHash = analysisHash(changed);
    changed.reportHash = reportHash(changed);
    assert.throws(() => validateApprovedDryRunReportText(JSON.stringify(changed)), /geldige lokale PASS-identiteit/);
  }
  const missing = { ...source };
  delete missing.source;
  missing.analysisHash = analysisHash(missing);
  missing.reportHash = reportHash(missing);
  assert.throws(() => validateApprovedDryRunReportText(JSON.stringify(missing)), /geldige lokale PASS-identiteit/);
});

test('inhoudelijke wijziging blokkeert op analysisHash', { skip: !existsSync(v4ReportPath) }, () => {
  const source = JSON.parse(readFileSync(v4ReportPath, 'utf8')) as Record<string, any>;
  const finalized = finalizeReport(source as any) as Record<string, any>;
  const changed = { ...finalized, receivedCardsTotal: finalized.receivedCardsTotal + 1 };
  changed.reportHash = reportHash(changed);
  assert.throws(() => validateApprovedDryRunReportText(JSON.stringify(changed)), /analysisHash/);
});
