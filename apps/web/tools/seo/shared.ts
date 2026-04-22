import { appendFile } from 'node:fs/promises';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function normalizeOrigin(input: string): string {
  const url = new URL(input.trim());
  return url.origin;
}

function parseCsvOrigins(value?: string): string[] {
  return partitionCsvOrigins(value).validOrigins;
}

function partitionCsvOrigins(value?: string): {
  invalidOrigins: string[];
  validOrigins: string[];
} {
  const validOrigins: string[] = [];
  const invalidOrigins: string[] = [];

  for (const entry of splitCsv(value)) {
    try {
      validOrigins.push(normalizeOrigin(entry));
    } catch {
      invalidOrigins.push(entry);
    }
  }

  return {
    invalidOrigins: dedupe(invalidOrigins),
    validOrigins: dedupe(validOrigins),
  };
}

function parseCsvUrls(value?: string): string[] {
  return dedupe(
    splitCsv(value).flatMap((entry) => {
      const parsed = toAbsoluteUrl(entry);
      return parsed ? [parsed] : [];
    })
  );
}

function parseToggle(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return fallback;
}

function resolveUrl(origin: string, path: string): string {
  return new URL(path, `${normalizeOrigin(origin)}/`).toString();
}

async function appendGitHubStepSummary(markdown: string) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (!summaryPath) {
    return;
  }

  await appendFile(summaryPath, `${markdown}\n`, 'utf8');
}

function splitCsv(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function toAbsoluteUrl(value: string): string | null {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

export const seoShared = {
  appendGitHubStepSummary,
  normalizeOrigin,
  parseCsvOrigins,
  parseCsvUrls,
  parseToggle,
  partitionCsvOrigins,
  resolveUrl,
} as const;
