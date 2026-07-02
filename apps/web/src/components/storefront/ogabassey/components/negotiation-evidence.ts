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

interface StorageUploadResult {
  data: { path?: string | null } | null;
  error: { message?: string } | null;
}

interface NegotiationEvidenceStorageClient {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: ArrayBuffer,
        options: { contentType: string; upsert: false }
      ) => Promise<StorageUploadResult>;
    };
  };
}

interface UploadNegotiationEvidenceFileParams {
  file: File;
  merchantId: string;
  supabase: NegotiationEvidenceStorageClient;
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

function getEvidenceFileSlug(fileName: string): string {
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, '');
  return (
    nameWithoutExtension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'evidence'
  );
}

export async function uploadNegotiationEvidenceFile({
  file,
  merchantId,
  supabase,
}: UploadNegotiationEvidenceFileParams): Promise<string> {
  const extension = getEvidenceFileExtension(file);
  if (!extension) {
    throw new Error('Upload a screenshot or photo.');
  }

  if (file.size > MAX_NEGOTIATION_EVIDENCE_BYTES) {
    throw new Error('Upload a proof image under 10 MB.');
  }

  const slug = getEvidenceFileSlug(file.name);
  const nonce = Math.random().toString(36).slice(2, 8);
  const evidencePath = `${merchantId}/${Date.now()}-${nonce}-${slug}.${extension}`;

  const { error } = await supabase.storage
    .from(NEGOTIATION_EVIDENCE_BUCKET)
    .upload(evidencePath, await file.arrayBuffer(), {
      contentType: file.type || `image/${extension}`,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Failed to upload evidence image.');
  }

  return evidencePath;
}
