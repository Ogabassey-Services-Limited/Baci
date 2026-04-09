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

async function extractViaOllama(
  fileBuffer: Uint8Array,
  _mimeType: string
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

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      prompt: CAC_EXTRACTION_PROMPT,
      images: [base64Image],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = (await response.json()) as { response?: string };
  return parseModelResponse(data.response ?? '');
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
  const isPdf = mimeType === 'application/pdf';

  if (isPdf) {
    return extractViaGemini(fileBuffer, mimeType);
  }

  // Image path: try Ollama first, fall back to Gemini
  const ollamaBaseUrl = getOllamaBaseUrl();
  if (ollamaBaseUrl) {
    try {
      return await extractViaOllama(fileBuffer, mimeType);
    } catch {
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
  if (!extracted.rcNumber && !extracted.businessName) {
    return { match: false, reason: 'Could not extract document data' };
  }

  const normalize = (s: string) => s.trim().toUpperCase();

  const extractedRc = normalize(extracted.rcNumber ?? '');
  const expectedRc = normalize(expectedRcNumber);

  if (extractedRc !== expectedRc) {
    return { match: false, reason: 'RC number mismatch' };
  }

  const extractedName = normalize(extracted.businessName ?? '');
  const expectedName = normalize(expectedBusinessName);

  const nameMatches =
    extractedName === expectedName ||
    extractedName.includes(expectedName) ||
    expectedName.includes(extractedName);

  if (!nameMatches) {
    return { match: false, reason: 'Business name mismatch' };
  }

  return { match: true };
}
