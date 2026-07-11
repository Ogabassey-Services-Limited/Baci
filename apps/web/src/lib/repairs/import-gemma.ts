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
 * Gemma transport orchestration for the repairs paste-import.
 *
 * Mirrors the quiz generator's transport selection (LLM server preferred, else
 * Ollama) and reuses the shared `requestGemmaCompletion`. Long pastes are
 * chunked (Gemma num_ctx is 2048) and parsed per chunk; failures surface as a
 * clean RepairsImportUnavailableError which the route maps to a 503.
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

async function parseChunk(
  chunk: string,
  transport: TransportConfig
): Promise<ParsedRepairRow[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);
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

export async function parseRepairPriceList(
  text: string
): Promise<ParsedRepairRow[]> {
  const transport = getRepairsImportTransportConfig();
  const chunks = chunkImportText(text, IMPORT_CHUNK_CHARS);
  const rows: ParsedRepairRow[] = [];
  for (const chunk of chunks) {
    rows.push(...(await parseChunk(chunk, transport)));
  }
  return dedupeRows(rows);
}
