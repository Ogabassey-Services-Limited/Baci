import { generateTextWithChain } from '@/ai/generate-text-with-chain';
import {
  getAiChatModel,
  getLlmChatModel,
  getLlmServerBearer,
  getLlmServerUrl,
  getOllamaBaseUrl,
  getOllamaBasicAuth,
} from '@/env';
import { requestGemmaCompletion } from '@/lib/gemma/gemma-completion';
import { buildLlmBearerAuthHeader } from '@/lib/llm-auth';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';
import {
  buildRepairImportPrompt,
  chunkImportText,
  type ParsedRepairRow,
  parseRepairImportResponse,
} from './import-parse';

/**
 * AI transport orchestration for the repairs paste-import.
 *
 * Per chunk, the cloud provider chain (Cerebras -> Groq -> Gemini ->
 * Gemini-Lite) is tried first to take load off the self-hosted VPS. When the
 * chain is exhausted (or its completion fails to parse), the legacy
 * LLM-server/Ollama transport — mirroring the quiz generator's transport
 * selection (LLM server preferred, else Ollama) — serves as the fallback so
 * self-host capability is preserved. Long pastes are chunked (Gemma num_ctx
 * is 2048) and parsed per chunk; failures surface as a clean
 * RepairsImportUnavailableError which the route maps to a 503.
 */

export class RepairsImportUnavailableError extends Error {
  constructor() {
    super('Gemma repairs import is not configured');
    this.name = 'RepairsImportUnavailableError';
  }
}

// Gemma runs with num_ctx 2048 (shared gemma-completion), which must hold the
// system prompt + JSON-wrapped chunk (input) AND the completion (output). Keep
// input (~900 chars ≈ 300 tokens + ~300 tokens of wrapper/system) and output
// well under 2048 so the model never silently truncates context mid-list.
const IMPORT_CHUNK_CHARS = 900;
const IMPORT_MAX_TOKENS = 1024;
const IMPORT_TEMPERATURE = 0.1;
const IMPORT_TIMEOUT_MS = 100_000;
// Chunks are small and focused, so cloud attempts stay tight — chunks run
// sequentially and each already has a generous 100s legacy fallback budget.
const IMPORT_CHAIN_PROVIDER_TIMEOUT_MS = 12_000;
// Bound a single chunk's whole cloud walk so 4 providers can't stack to ~48s.
const IMPORT_CHAIN_BUDGET_MS = 15_000;
// Aggregate wall-clock budget for the ENTIRE import (all chunks), kept under
// the route's 120s maxDuration. Without it, sequential chunks each carrying a
// 100s legacy fallback could run for minutes and blow the route deadline
// mid-chunk (leaving a silently-truncated catalog). Each chunk's chain and
// legacy attempts are capped to the time remaining against this deadline.
const IMPORT_AGGREGATE_BUDGET_MS = 110_000;

const SYSTEM_PROMPT =
  'You extract structured repair price rows from pasted price lists. Return strict JSON shaped as {"rows": [...]} with brand, model, repair_type, and numeric price fields. No markdown.';

type TransportConfig =
  | { llmServerUrl: string; llmServerBearer: string; model: string }
  | {
      ollamaBaseUrl: string;
      ollamaBasicAuth: string | undefined;
      model: string;
    };

function getRepairsImportTransportConfig(): TransportConfig {
  const llmServerUrl = getLlmServerUrl();
  if (llmServerUrl) {
    const llmServerBearer = getLlmServerBearer();
    if (!llmServerBearer || !buildLlmBearerAuthHeader(llmServerBearer)) {
      throw new RepairsImportUnavailableError();
    }
    return { llmServerUrl, llmServerBearer, model: getLlmChatModel() };
  }

  const ollamaBaseUrl = getOllamaBaseUrl();
  if (!ollamaBaseUrl) {
    throw new RepairsImportUnavailableError();
  }

  const ollamaBasicAuth = getOllamaBasicAuth();
  if (ollamaBasicAuth && !buildOllamaBasicAuthHeader(ollamaBasicAuth)) {
    throw new RepairsImportUnavailableError();
  }

  return { model: getAiChatModel(), ollamaBaseUrl, ollamaBasicAuth };
}

// The legacy transport is now an optional per-chunk fallback rather than a
// hard prerequisite — the cloud chain alone can serve every chunk. Resolve it
// once up front (env-derived, stable across chunks) without throwing, so an
// unconfigured VPS never blocks a chain-only import.
function resolveOptionalRepairsImportTransportConfig(): TransportConfig | null {
  try {
    return getRepairsImportTransportConfig();
  } catch {
    return null;
  }
}

function dedupeRows(rows: ParsedRepairRow[]): ParsedRepairRow[] {
  const seen = new Set<string>();
  const result: ParsedRepairRow[] = [];
  for (const row of rows) {
    const key = [
      row.brand.toLowerCase(),
      row.model.toLowerCase(),
      row.repairType.toLowerCase(),
      (row.partQuality ?? '').toLowerCase(),
    ].join('|');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(row);
  }
  return result;
}

async function parseChunkWithChain(
  chunk: string,
  deadlineMs: number
): Promise<ParsedRepairRow[]> {
  const remainingMs = Math.max(0, deadlineMs - Date.now());
  const chainResult = await generateTextWithChain({
    system: SYSTEM_PROMPT,
    prompt: buildRepairImportPrompt(chunk),
    temperature: IMPORT_TEMPERATURE,
    maxOutputTokens: IMPORT_MAX_TOKENS,
    perProviderTimeoutMs: IMPORT_CHAIN_PROVIDER_TIMEOUT_MS,
    overallTimeoutMs: Math.min(IMPORT_CHAIN_BUDGET_MS, remainingMs),
  });
  return parseRepairImportResponse(chainResult.text);
}

async function parseChunkWithLegacyTransport(
  chunk: string,
  transport: TransportConfig,
  deadlineMs: number
): Promise<ParsedRepairRow[]> {
  const controller = new AbortController();
  const budgetMs = Math.min(
    IMPORT_TIMEOUT_MS,
    Math.max(0, deadlineMs - Date.now())
  );
  const timeout = setTimeout(() => controller.abort(), budgetMs);
  try {
    const content = await requestGemmaCompletion({
      ...transport,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildRepairImportPrompt(chunk) },
      ],
      maxTokens: IMPORT_MAX_TOKENS,
      temperature: IMPORT_TEMPERATURE,
      signal: controller.signal,
    });
    return parseRepairImportResponse(content);
  } finally {
    clearTimeout(timeout);
  }
}

// Cloud chain first (per chunk); the legacy transport below is the
// last-resort fallback, and only when it is actually configured — a
// chunk-level chain failure with no legacy transport means this chunk (and
// therefore the whole import) is unavailable.
async function parseChunk(
  chunk: string,
  transport: TransportConfig | null,
  deadlineMs: number
): Promise<ParsedRepairRow[]> {
  try {
    return await parseChunkWithChain(chunk, deadlineMs);
  } catch (chainError) {
    console.warn(
      '[repairs-import] cloud provider chain failed for a chunk; falling back:',
      chainError instanceof Error ? chainError.message : String(chainError)
    );
  }

  if (!transport) {
    throw new RepairsImportUnavailableError();
  }

  return parseChunkWithLegacyTransport(chunk, transport, deadlineMs);
}

export async function parseRepairPriceList(
  text: string
): Promise<ParsedRepairRow[]> {
  const transport = resolveOptionalRepairsImportTransportConfig();
  const chunks = chunkImportText(text, IMPORT_CHUNK_CHARS);
  const rows: ParsedRepairRow[] = [];
  const deadlineMs = Date.now() + IMPORT_AGGREGATE_BUDGET_MS;
  for (const chunk of chunks) {
    // Fail loudly rather than return a silently-truncated catalog when the
    // aggregate budget is spent mid-import — the merchant reviews these rows
    // as if they were the whole list.
    if (Date.now() >= deadlineMs) {
      throw new RepairsImportUnavailableError();
    }
    rows.push(...(await parseChunk(chunk, transport, deadlineMs)));
  }
  return dedupeRows(rows);
}
