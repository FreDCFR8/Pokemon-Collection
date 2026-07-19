import { createHash } from 'node:crypto';

/**
 * Canonical JSON identity for catalog reports.
 * Object keys are sorted, object properties with undefined are omitted like
 * JSON.stringify, and array order is retained because it is meaningful.
 * The top-level reportHash is excluded so a report can be verified both
 * before and after its hash has been attached.
 */
export function canonicalReportJson(value: unknown, topLevel = true): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalReportJson(item, false)).join(',')}]`;
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .filter((key) => !(topLevel && key === 'reportHash'))
      .filter((key) => objectValue[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalReportJson(objectValue[key], false)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function reportHash(report: unknown): string {
  return createHash('sha256').update(canonicalReportJson(report), 'utf8').digest('hex');
}

export function parseReportJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

export function reportHashFromText(text: string): string {
  return reportHash(parseReportJson(text));
}

const VOLATILE_ANALYSIS_FIELDS = new Set([
  'reportHash', 'analysisHash', 'startedAt', 'finishedAt', 'updatedAt',
  'checkpoint', 'checkpointPath', 'checkpointStatus', 'resume', 'resumed',
  'skippedCompletedSets', 'setsExecutedThisInvocation', 'temporaryExecutionMetadata',
]);

function analysisValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(analysisValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !VOLATILE_ANALYSIS_FIELDS.has(key))
      .map(([key, nested]) => [key, analysisValue(nested)]));
  }
  return value;
}

export function canonicalAnalysisJson(report: unknown): string {
  return canonicalReportJson(analysisValue(report));
}

export function analysisHash(report: unknown): string {
  return createHash('sha256').update(canonicalAnalysisJson(report), 'utf8').digest('hex');
}

export function analysisHashFromText(text: string): string {
  return analysisHash(parseReportJson(text));
}
