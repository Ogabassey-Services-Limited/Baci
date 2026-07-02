import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

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

const evidenceRequestSchema = z.object({
  merchantId: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_NEGOTIATION_EVIDENCE_BYTES),
  contentType: z.string().trim().toLowerCase().max(120),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function getEvidenceFileExtension({
  contentType,
  fileName,
}: {
  contentType: string;
  fileName: string;
}): string | null {
  if (contentType && contentType !== 'application/octet-stream') {
    return ALLOWED_NEGOTIATION_EVIDENCE_TYPES.get(contentType) ?? null;
  }

  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  if (!fileExtension) {
    return null;
  }

  return [...ALLOWED_NEGOTIATION_EVIDENCE_TYPES.values()].includes(
    fileExtension
  )
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

function buildEvidencePath({
  extension,
  fileName,
  merchantId,
}: {
  extension: string;
  fileName: string;
  merchantId: string;
}) {
  const slug = getEvidenceFileSlug(fileName);
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${merchantId}/${Date.now()}-${nonce}-${slug}.${extension}`;
}

function getStorageContentType(contentType: string, extension: string) {
  if (contentType && contentType !== 'application/octet-stream') {
    return contentType;
  }

  return extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit(request);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(
      rateLimit.limit,
      rateLimit.remaining,
      rateLimit.resetTime
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Invalid evidence upload request.', 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonError('Upload a screenshot or photo.', 400);
  }

  const parsed = evidenceRequestSchema.safeParse({
    contentType: file.type,
    fileName: file.name,
    fileSize: file.size,
    merchantId: formData.get('merchantId'),
  });

  if (!parsed.success) {
    return jsonError('Upload a proof image under 10 MB.', 400);
  }

  const extension = getEvidenceFileExtension({
    contentType: parsed.data.contentType,
    fileName: parsed.data.fileName,
  });
  if (!extension) {
    return jsonError('Upload a screenshot or photo.', 400);
  }

  const admin = createAdminClient();
  const { data: merchant, error: merchantError } = await admin
    .from('merchants')
    .select('id')
    .eq('id', parsed.data.merchantId)
    .maybeSingle();

  if (merchantError) {
    return jsonError('Failed to validate storefront merchant.', 500);
  }

  if (!merchant) {
    return jsonError('Storefront merchant not found.', 404);
  }

  const evidencePath = buildEvidencePath({
    extension,
    fileName: parsed.data.fileName,
    merchantId: parsed.data.merchantId,
  });

  const { error: uploadError } = await admin.storage
    .from(NEGOTIATION_EVIDENCE_BUCKET)
    .upload(evidencePath, await file.arrayBuffer(), {
      contentType: getStorageContentType(parsed.data.contentType, extension),
      upsert: false,
    });

  if (uploadError) {
    return jsonError(
      uploadError.message || 'Failed to upload evidence image.',
      500
    );
  }

  return NextResponse.json({ evidencePath });
}
