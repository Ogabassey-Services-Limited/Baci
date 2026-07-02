import { createClient } from '@/lib/supabase/client';

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
  if (fileType && fileType !== 'application/octet-stream') {
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

function getEvidenceContentType({
  extension,
  file,
}: {
  extension: string;
  file: File;
}) {
  const normalizedFileType = file.type.trim().toLowerCase();
  if (normalizedFileType && normalizedFileType !== 'application/octet-stream') {
    return normalizedFileType;
  }

  return extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
}

async function readEvidenceUploadResponse(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    contentType?: string;
    error?: string;
    evidencePath?: string;
    uploadToken?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || 'Failed to upload evidence image.');
  }

  if (!body?.evidencePath || !body.uploadToken) {
    throw new Error('Failed to upload evidence image.');
  }

  return {
    contentType: body.contentType,
    evidencePath: body.evidencePath,
    uploadToken: body.uploadToken,
  };
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

  const contentType = getEvidenceContentType({ extension, file });
  const response = await fetch('/api/storefront/negotiation-evidence', {
    body: JSON.stringify({
      contentType,
      fileName: file.name,
      fileSize: file.size,
      merchantId,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  const upload = await readEvidenceUploadResponse(response);
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(NEGOTIATION_EVIDENCE_BUCKET)
    .uploadToSignedUrl(upload.evidencePath, upload.uploadToken, file, {
      contentType: upload.contentType || contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Failed to upload evidence image.');
  }

  return upload.evidencePath;
}
