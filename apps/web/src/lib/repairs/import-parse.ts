import { z } from 'zod';

/**
 * Pure parsing helpers for the AI paste-import pipeline.
 *
 * Gemma runs with a small context window (num_ctx 2048), so long pastes are
 * chunked on line boundaries before each call. The model is asked for strict
 * JSON rows; the response is validated with Zod and prices are normalized from
 * WhatsApp-style strings ("₦25,000") into numbers. No DB access here.
 */

export interface ParsedRepairRow {
  brand: string;
  model: string;
  repairType: string;
  price: number;
  partQuality: string | null;
}

const PRICE_STRIP = /[^0-9.]/g;

function normalizePrice(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  // Reject negatives before PRICE_STRIP removes the sign (e.g. "-25,000").
  if (value.trim().startsWith('-')) {
    return null;
  }
  const cleaned = value.replace(PRICE_STRIP, '');
  if (cleaned === '' || cleaned === '.') {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const rawRowSchema = z.object({
  brand: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(160),
  repair_type: z.string().trim().min(1).max(120),
  price: z.union([z.number(), z.string()]),
  part_quality: z.string().trim().min(1).max(120).nullish(),
});

const rawResponseSchema = z.object({
  rows: z.array(rawRowSchema).max(1000),
});

const STRIP_FENCE_OPEN = /^```(?:json)?\s*/i;
const STRIP_FENCE_CLOSE = /\s*```$/i;

function stripJsonFence(content: string): string {
  return content
    .trim()
    .replace(STRIP_FENCE_OPEN, '')
    .replace(STRIP_FENCE_CLOSE, '')
    .trim();
}

/**
 * Validates a Gemma completion into typed rows. Rows whose price cannot be
 * parsed to a non-negative number are dropped (a merchant can re-add them by
 * hand). Throws when the content is empty or not valid JSON in the expected
 * shape — the caller maps that to a clean error.
 */
export function parseRepairImportResponse(content: unknown): ParsedRepairRow[] {
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Empty repair import response');
  }

  let json: unknown;
  try {
    json = JSON.parse(stripJsonFence(content));
  } catch {
    // Normalize a raw SyntaxError so callers always see the same clean error
    // for both syntactically invalid and schema-invalid JSON.
    throw new Error('Invalid repair import JSON');
  }

  const parsed = rawResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('Invalid repair import JSON');
  }

  const rows: ParsedRepairRow[] = [];
  for (const raw of parsed.data.rows) {
    const price = normalizePrice(raw.price);
    if (price === null) {
      continue;
    }
    rows.push({
      brand: raw.brand,
      model: raw.model,
      repairType: raw.repair_type,
      price,
      partQuality: raw.part_quality ?? null,
    });
  }
  return rows;
}

const CHUNK_INSTRUCTIONS = [
  'You extract repair price rows from a pasted WhatsApp-style price list.',
  'Return JSON only, no markdown, shaped as {"rows": [...]}.',
  'Each row: {"brand": string, "model": string, "repair_type": string, "price": number, "part_quality"?: string}.',
  'brand/model identify the device (e.g. brand "Apple", model "iPhone 12").',
  'repair_type is the service (e.g. "Screen Replacement", "Battery").',
  'price is the amount in the local currency as a number (strip currency symbols and commas).',
  'part_quality is optional (e.g. "OEM", "Aftermarket"). Omit rows you cannot confidently parse.',
];

export function buildRepairImportPrompt(chunk: string): string {
  return JSON.stringify(
    {
      instructions: CHUNK_INSTRUCTIONS,
      priceList: chunk,
      requiredJsonShape: {
        rows: [
          {
            brand: 'Apple',
            model: 'iPhone 12',
            repair_type: 'Screen Replacement',
            price: 25000,
            part_quality: 'OEM',
          },
        ],
      },
    },
    null,
    2
  );
}

/**
 * Splits pasted text into chunks under `maxChars`, never breaking a line.
 * A single line longer than `maxChars` becomes its own (over-long) chunk.
 */
export function chunkImportText(text: string, maxChars: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    if (current === '') {
      current = line;
      continue;
    }
    if (current.length + 1 + line.length <= maxChars) {
      current = `${current}\n${line}`;
    } else {
      chunks.push(current);
      current = line;
    }
  }
  if (current !== '') {
    chunks.push(current);
  }
  return chunks.length > 0 ? chunks : [text];
}
