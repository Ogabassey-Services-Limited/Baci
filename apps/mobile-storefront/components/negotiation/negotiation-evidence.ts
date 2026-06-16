import { supabase } from '@/lib/supabase';

export const NEGOTIATION_EVIDENCE_BUCKET = 'negotiation-evidence';
export const MAX_NEGOTIATION_EVIDENCE_BYTES = 10 * 1024 * 1024;

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
  if (normalizedBlobType) {
    return normalizedBlobType;
  }

  const extension = extractNegotiationFileExtension(uri, '');
  return EXTENSION_TO_CONTENT_TYPE[extension] ?? '';
};

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

  const response = await fetch(fileUri);
  if (!response.ok) {
    throw new Error(`Failed to read evidence file: ${response.status}`);
  }

  const blob = await response.blob();
  const contentType = resolveEvidenceContentType(fileUri, blob.type);
  if (!ALLOWED_NEGOTIATION_EVIDENCE_TYPES.has(contentType)) {
    throw new Error('Only image evidence is supported');
  }

  if (blob.size <= 0 || blob.size > MAX_NEGOTIATION_EVIDENCE_BYTES) {
    throw new Error('Evidence image is too large');
  }

  const extension = extractNegotiationFileExtension(fileUri, contentType);
  const filePath = `${merchantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const body = await blob.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(NEGOTIATION_EVIDENCE_BUCKET)
    .upload(filePath, body, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  // Persist the durable Storage object path, not a Supabase signed URL.
  // Signed URLs expire by design; merchant review screens should mint a fresh
  // URL from this path when evidence viewing is implemented.
  return filePath;
}
