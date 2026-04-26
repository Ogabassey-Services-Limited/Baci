import { generateText } from 'ai';
import { activeTextModel } from '@/ai/provider';
import { getOllamaBaseUrl, getOllamaBasicAuth, getOllamaCacModel } from '@/env';

export interface CACVerificationResult {
  documentType: string | null;
  rcNumber: string | null;
  businessName: string | null;
}

const CAC_EXTRACTION_PROMPT =
  'Extract from this CAC document: 1) document type (Certificate of Incorporation or Certificate of Registration), 2) the RC or BN number, 3) the registered business name. Reply in JSON: {"documentType": "...", "rcNumber": "...", "businessName": "..."}';

const OLLAMA_TIMEOUT_MS = 30_000;

function parseModelResponse(text: string): CACVerificationResult {
  try {
    // Extract JSON from response — model may wrap it in markdown fences
    const match = text.match(/\{[\s\S]*\}/);
    if (!match)
      return { documentType: null, rcNumber: null, businessName: null };
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      documentType:
        typeof parsed.documentType === 'string' ? parsed.documentType : null,
      rcNumber: typeof parsed.rcNumber === 'string' ? parsed.rcNumber : null,
      businessName:
        typeof parsed.businessName === 'string' ? parsed.businessName : null,
    };
  } catch {
    return { documentType: null, rcNumber: null, businessName: null };
  }
}

function hasRequiredVerificationFields(result: CACVerificationResult): boolean {
  return Boolean(result.rcNumber && result.businessName);
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
    headers.Authorization = `Basic ${basicAuth}`;
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

async function extractViaGemini(
  fileBuffer: Uint8Array,
  mimeType: string
): Promise<CACVerificationResult> {
  const { text } = await generateText({
    model: activeTextModel,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: fileBuffer,
            mediaType: mimeType,
          },
          { type: 'text', text: CAC_EXTRACTION_PROMPT },
        ],
      },
    ],
  });
  return parseModelResponse(text);
}

export async function extractCACCertificateData(
  fileBuffer: Uint8Array,
  mimeType: string
): Promise<CACVerificationResult> {
  // Try the VPS-hosted Ollama/Gemma extractor first for every supported upload
  // type, including PDFs. Gemini remains a fallback when Ollama is unavailable.
  const ollamaBaseUrl = getOllamaBaseUrl();
  if (ollamaBaseUrl) {
    try {
      const extracted = await extractViaOllama(fileBuffer);
      if (hasRequiredVerificationFields(extracted)) {
        return extracted;
      }
      console.warn(
        'Ollama extraction omitted required verification fields, falling back to Gemini.'
      );
    } catch (error) {
      console.warn('Ollama extraction failed, falling back to Gemini:', error);
      // Fall through to Gemini
    }
  }

  return extractViaGemini(fileBuffer, mimeType);
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
