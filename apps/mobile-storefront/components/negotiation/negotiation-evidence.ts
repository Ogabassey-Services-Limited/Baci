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
