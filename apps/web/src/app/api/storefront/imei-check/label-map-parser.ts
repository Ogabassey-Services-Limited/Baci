import { stripHtmlTags } from '@/lib/sanitize-core';

export type ProviderLabelInput =
  | Record<string, unknown>
  | null
  | string
  | undefined;

function sanitizeProviderValue(value: unknown): string {
  if (value == null) return '';

  const decoded = String(value)
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#60;/g, '<')
    .replace(/&#62;/g, '>')
    .replace(/&#x3c;/gi, '<')
    .replace(/&#x3e;/gi, '>');

  return stripHtmlTags(decoded).replace(/[<>]/g, '').trim();
}

function canonicalLabel(
  label: string,
  aliases: Readonly<Record<string, string>>
): string {
  const normalized = label.trim().toLowerCase();
  return aliases[normalized] ?? normalized;
}

export function parseProviderLabelMap(
  input: ProviderLabelInput,
  aliases: Readonly<Record<string, string>> = {}
): Record<string, string> {
  const data: Record<string, string> = {};

  if (input == null) return data;

  if (typeof input === 'object') {
    for (const [label, value] of Object.entries(input)) {
      data[canonicalLabel(label, aliases)] = sanitizeProviderValue(value);
    }
    return data;
  }

  const lines = input
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex < 1) continue;

    const label = canonicalLabel(line.slice(0, colonIndex), aliases);
    data[label] = sanitizeProviderValue(line.slice(colonIndex + 1));
  }

  return data;
}
