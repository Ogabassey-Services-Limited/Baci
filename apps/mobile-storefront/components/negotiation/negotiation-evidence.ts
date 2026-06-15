import { supabase } from '@/lib/supabase';

export const NEGOTIATION_EVIDENCE_BUCKET = 'negotiation-evidence';

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
    return fromContentType;
  }

  const uriMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return uriMatch?.[1] ?? 'jpg';
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
  const extension = extractNegotiationFileExtension(fileUri, blob.type);
  const filePath = `${merchantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const body = await blob.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(NEGOTIATION_EVIDENCE_BUCKET)
    .upload(filePath, body, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(NEGOTIATION_EVIDENCE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}
