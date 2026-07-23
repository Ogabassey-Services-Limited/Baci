import {
  ALL_TEXT_PROVIDERS_FAILED_ERROR_NAME,
  generateTextWithChain,
} from '@/ai/generate-text-with-chain';
import { getVisionProviderChain } from '@/ai/vision-provider-chain';
import { getOllamaBaseUrl, getOllamaBasicAuth, getOllamaCacModel } from '@/env';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';

export interface CACVerificationResult {
  documentType: string | null;
  rcNumber: string | null;
  businessName: string | null;
}

const CAC_EXTRACTION_PROMPT =
  'Extract from this CAC document: 1) document type (Certificate of Incorporation or Certificate of Registration), 2) the RC or BN number, 3) the registered business name. Reply in JSON: {"documentType": "...", "rcNumber": "...", "businessName": "..."}';

const OLLAMA_TIMEOUT_MS = 5_000;
// Vision-chain attempts (Cerebras -> Gemini Flash -> Gemini Flash-Lite for
// images; Gemini Flash -> Flash-Lite for PDFs) run inline on the request, so
// each provider gets a tight budget rather than the 60s async-job allowance
// used by the storefront-layout pipeline.
const CHAIN_PER_PROVIDER_TIMEOUT_MS = 8_000;
const PDF_MIME_TYPE = 'application/pdf';

function nullVerificationResult(): CACVerificationResult {
  return { documentType: null, rcNumber: null, businessName: null };
}

function parseModelResponse(text: string): CACVerificationResult {
  try {
    // Extract JSON from response — model may wrap it in markdown fences
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return nullVerificationResult();
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      documentType:
        typeof parsed.documentType === 'string' ? parsed.documentType : null,
      rcNumber: typeof parsed.rcNumber === 'string' ? parsed.rcNumber : null,
      businessName:
        typeof parsed.businessName === 'string' ? parsed.businessName : null,
    };
  } catch {
    return nullVerificationResult();
  }
}

function hasRequiredVerificationFields(result: CACVerificationResult): boolean {
  return Boolean(result.rcNumber?.trim() && result.businessName?.trim());
}

function isChainExhaustedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === ALL_TEXT_PROVIDERS_FAILED_ERROR_NAME
  );
}

async function extractViaOllama(
  fileBuffer: Uint8Array
): Promise<CACVerificationResult> {
  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaCacModel();
  const basicAuth = getOllamaBasicAuth();

  const base64Image = Buffer.from(fileBuffer).toString('base64');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (basicAuth) {
    const authorization = buildOllamaBasicAuthHeader(basicAuth);
    if (!authorization) {
      throw new Error(
        'Invalid OLLAMA_BASIC_AUTH: failed to construct Basic auth header'
      );
    }
    headers.Authorization = authorization;
  }

  // Normalize baseUrl: strip trailing slashes and trailing "/api" to prevent
  // double-path when OLLAMA_BASE_URL already ends with "/api" (e.g. ".../api/")
  const normalizedBase = (baseUrl ?? '')
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizedBase}/api/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        prompt: CAC_EXTRACTION_PROMPT,
        images: [base64Image],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = (await response.json()) as { response?: string };
    return parseModelResponse(data.response ?? '');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Ollama request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Image-input tier: walks the vision provider chain (Cerebras -> Gemini
 * Flash -> Gemini Flash-Lite). `acceptResult` gates on completeness, so an
 * incomplete extraction from one provider falls through to the next
 * automatically instead of being treated as a success.
 */
async function extractViaVisionChain(
  fileBuffer: Uint8Array,
  mimeType: string
): Promise<CACVerificationResult> {
  const { text } = await generateTextWithChain({
    chain: getVisionProviderChain(),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: fileBuffer, mediaType: mimeType },
          { type: 'text', text: CAC_EXTRACTION_PROMPT },
        ],
      },
    ],
    perProviderTimeoutMs: CHAIN_PER_PROVIDER_TIMEOUT_MS,
    acceptResult: (candidate) =>
      hasRequiredVerificationFields(parseModelResponse(candidate)),
  });
  return parseModelResponse(text);
}

/**
 * PDF-input tier: Cerebras cannot accept PDFs, so this walks the Gemini-only
 * subset of the vision chain (Flash -> Flash-Lite). No Ollama tier exists for
 * PDFs — the VPS extractor's vision endpoint only accepts image payloads.
 */
async function extractViaGoogleChain(
  fileBuffer: Uint8Array,
  mimeType: string
): Promise<CACVerificationResult> {
  const { text } = await generateTextWithChain({
    chain: getVisionProviderChain().filter((provider) =>
      provider.name.startsWith('google:')
    ),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'file', data: fileBuffer, mediaType: mimeType },
          { type: 'text', text: CAC_EXTRACTION_PROMPT },
        ],
      },
    ],
    perProviderTimeoutMs: CHAIN_PER_PROVIDER_TIMEOUT_MS,
    // Gate on completeness like the image branch: a non-empty but incomplete
    // Flash response (missing RC or business name) must fall through to
    // Flash-Lite rather than being accepted and converted to null fields.
    acceptResult: (candidate) =>
      hasRequiredVerificationFields(parseModelResponse(candidate)),
  });
  return parseModelResponse(text);
}

export async function extractCACCertificateData(
  fileBuffer: Uint8Array,
  mimeType: string
): Promise<CACVerificationResult> {
  // Ollama's vision endpoint expects image payloads, and Cerebras cannot
  // accept PDFs either — PDFs stay on the Gemini-only chain.
  if (mimeType === PDF_MIME_TYPE) {
    return extractViaGoogleChain(fileBuffer, mimeType);
  }

  try {
    return await extractViaVisionChain(fileBuffer, mimeType);
  } catch (error) {
    if (!isChainExhaustedError(error)) {
      throw error;
    }
    console.warn(
      '[CAC Verification] vision provider chain exhausted, falling back to Ollama VPS:',
      error
    );
  }

  // Last resort: the VPS-hosted Ollama/Gemma extractor. Mirrors the previous
  // final-answer semantic — whatever it returns (even incomplete) is the
  // answer, since nothing is left to fall back to after it.
  const ollamaBaseUrl = getOllamaBaseUrl();
  if (!ollamaBaseUrl) {
    return nullVerificationResult();
  }

  try {
    return await extractViaOllama(fileBuffer);
  } catch (error) {
    console.warn(
      '[CAC Verification] Ollama fallback extraction failed:',
      error
    );
    return nullVerificationResult();
  }
}

export function compareCACData(
  extracted: CACVerificationResult,
  expectedRcNumber: string,
  expectedBusinessName: string
): { match: boolean; reason?: string } {
  if (!expectedRcNumber.trim() || !expectedBusinessName.trim()) {
    return { match: false, reason: 'Expected values cannot be empty' };
  }

  if (!extracted.rcNumber && !extracted.businessName) {
    return { match: false, reason: 'Could not extract document data' };
  }

  const normalize = (s: string) => s.trim().toUpperCase();

  if (!extracted.rcNumber) {
    return { match: false, reason: 'RC number could not be extracted' };
  }

  const extractedRc = normalize(extracted.rcNumber);
  const expectedRc = normalize(expectedRcNumber);

  if (extractedRc !== expectedRc) {
    return { match: false, reason: 'RC number mismatch' };
  }

  if (!extracted.businessName) {
    return { match: false, reason: 'Business name could not be extracted' };
  }

  const extractedName = normalize(extracted.businessName);
  const expectedName = normalize(expectedBusinessName);

  // Guard: empty extractedName (blank OCR result) must not pass on RC match alone
  if (!extractedName) {
    return { match: false, reason: 'Business name mismatch' };
  }

  // One-direction check: extracted certificate name must contain the expected
  // registered name. This prevents short strings (e.g. "A") from matching
  // long company names.
  const nameMatches =
    extractedName === expectedName || extractedName.includes(expectedName);

  if (!nameMatches) {
    return { match: false, reason: 'Business name mismatch' };
  }

  return { match: true };
}
