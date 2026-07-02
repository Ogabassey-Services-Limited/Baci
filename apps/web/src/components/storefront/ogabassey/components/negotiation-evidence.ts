export const NEGOTIATION_EVIDENCE_BUCKET = 'negotiation-evidence';

const MAX_NEGOTIATION_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_NEGOTIATION_EVIDENCE_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
]);

interface UploadNegotiationEvidenceFileParams {
  file: File;
  merchantId: string;
}

function getEvidenceFileExtension(file: File): string | null {
  const fileType = file.type.trim().toLowerCase();
  const typeExtension = ALLOWED_NEGOTIATION_EVIDENCE_TYPES.get(fileType);
  if (typeExtension) {
    return typeExtension;
  }
  if (fileType) {
    return null;
  }

  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (!fileExtension) {
    return null;
  }

  return [...ALLOWED_NEGOTIATION_EVIDENCE_TYPES.values()].includes(fileExtension)
    ? fileExtension
    : null;
}

async function readEvidenceUploadResponse(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    evidencePath?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || 'Failed to upload evidence image.');
  }

  if (!body?.evidencePath) {
    throw new Error('Failed to upload evidence image.');
  }

  return body.evidencePath;
}

export async function uploadNegotiationEvidenceFile({
  file,
  merchantId,
}: UploadNegotiationEvidenceFileParams): Promise<string> {
  const extension = getEvidenceFileExtension(file);
  if (!extension) {
    throw new Error('Upload a screenshot or photo.');
  }

  if (file.size > MAX_NEGOTIATION_EVIDENCE_BYTES) {
    throw new Error('Upload a proof image under 10 MB.');
  }

  const formData = new FormData();
  formData.set('merchantId', merchantId);
  formData.set('file', file);

  const response = await fetch('/api/storefront/negotiation-evidence', {
    body: formData,
    method: 'POST',
  });

  return readEvidenceUploadResponse(response);
}
