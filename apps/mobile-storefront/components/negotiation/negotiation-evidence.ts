import { fetchWithTimeout } from '@baci/shared/lib';
import { EXPO_PUBLIC_API_URL } from '@/env';
import { supabase } from '@/lib/supabase';

export const NEGOTIATION_EVIDENCE_BUCKET = 'negotiation-evidence';
export const MAX_NEGOTIATION_EVIDENCE_BYTES = 10 * 1024 * 1024;
const NEGOTIATION_EVIDENCE_FETCH_TIMEOUT_MS = 30_000;
const NEGOTIATION_EVIDENCE_FETCH_TIMEOUT_MESSAGE =
  'Evidence upload took too long. Please try again.';

const ALLOWED_NEGOTIATION_EVIDENCE_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const createNegotiationSessionId = () =>
  `mobile-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}`;

export const isRemoteEvidenceUrl = (value: string) =>
  /^https?:\/\//i.test(value);

export const extractNegotiationFileExtension = (
  uri: string,
  contentType: string
) => {
  const fromContentType = contentType.split('/')[1]?.split(';')[0];
  if (fromContentType && fromContentType !== 'octet-stream') {
    return fromContentType === 'jpeg' ? 'jpg' : fromContentType;
  }

  const uriMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return uriMatch?.[1]?.toLowerCase() ?? 'jpg';
};

const resolveEvidenceContentType = (uri: string, blobType: string) => {
  const normalizedBlobType = blobType.split(';')[0]?.trim().toLowerCase();
  if (normalizedBlobType && normalizedBlobType !== 'application/octet-stream') {
    return normalizedBlobType;
  }

  const extension = extractNegotiationFileExtension(uri, '');
  return EXTENSION_TO_CONTENT_TYPE[extension] ?? '';
};

const resolveEvidenceUploadUrl = () =>
  `${EXPO_PUBLIC_API_URL.replace(/\/+$/, '')}/api/storefront/negotiation-evidence`;

function getResponseContentLength(response: Response) {
  const rawContentLength = response.headers?.get('content-length');
  if (!rawContentLength) {
    return null;
  }

  const contentLength = Number.parseInt(rawContentLength, 10);
  return Number.isFinite(contentLength) ? contentLength : null;
}

async function readEvidenceUploadResponse(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    contentType?: string;
    error?: string;
    evidencePath?: string;
    uploadToken?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || 'Failed to upload evidence image');
  }

  if (!body?.evidencePath || !body.uploadToken) {
    throw new Error('Failed to upload evidence image');
  }

  return {
    contentType: body.contentType,
    evidencePath: body.evidencePath,
    uploadToken: body.uploadToken,
  };
}

export async function uploadNegotiationEvidence(
  fileUri: string,
  merchantId: string | null
): Promise<string> {
  if (isRemoteEvidenceUrl(fileUri)) {
    return fileUri;
  }

  if (!merchantId) {
    throw new Error('Missing merchant id');
  }

  const response = await fetchWithTimeout(fileUri, {
    timeoutMessage: NEGOTIATION_EVIDENCE_FETCH_TIMEOUT_MESSAGE,
    timeoutMs: NEGOTIATION_EVIDENCE_FETCH_TIMEOUT_MS,
  });
  if (!response.ok) {
    throw new Error(`Failed to read evidence file: ${response.status}`);
  }

  const responseContentType = response.headers?.get('content-type') ?? '';
  const contentType = resolveEvidenceContentType(fileUri, responseContentType);
  if (!ALLOWED_NEGOTIATION_EVIDENCE_TYPES.has(contentType)) {
    throw new Error('Only image evidence is supported');
  }

  const contentLength = getResponseContentLength(response);
  if (
    contentLength !== null &&
    (contentLength <= 0 || contentLength > MAX_NEGOTIATION_EVIDENCE_BYTES)
  ) {
    throw new Error('Evidence image is too large');
  }

  const evidenceBytes = await response.arrayBuffer();
  const evidenceSize = evidenceBytes.byteLength;
  if (evidenceSize <= 0 || evidenceSize > MAX_NEGOTIATION_EVIDENCE_BYTES) {
    throw new Error('Evidence image is too large');
  }

  const extension = extractNegotiationFileExtension(fileUri, contentType);
  const uploadResponse = await fetchWithTimeout(resolveEvidenceUploadUrl(), {
    body: JSON.stringify({
      contentType,
      fileName: `negotiation-evidence.${extension}`,
      fileSize: evidenceSize,
      merchantId,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    timeoutMessage: NEGOTIATION_EVIDENCE_FETCH_TIMEOUT_MESSAGE,
    timeoutMs: NEGOTIATION_EVIDENCE_FETCH_TIMEOUT_MS,
  });

  const upload = await readEvidenceUploadResponse(uploadResponse);
  const { error } = await supabase.storage
    .from(NEGOTIATION_EVIDENCE_BUCKET)
    .uploadToSignedUrl(upload.evidencePath, upload.uploadToken, evidenceBytes, {
      contentType: upload.contentType || contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Failed to upload evidence image');
  }

  return upload.evidencePath;
}
