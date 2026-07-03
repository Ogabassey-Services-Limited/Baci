import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseJwtSecret } from '@/env';
import { createScopedClient } from '@/lib/supabase/scoped';
import { createClient } from '@/lib/supabase/server';

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

const NEGOTIATION_EVIDENCE_UPLOAD_CLAIM = 'negotiation_evidence_upload';

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
  const nonce = randomUUID();
  return `${merchantId}/${Date.now()}-${nonce}-${slug}.${extension}`;
}

function getStorageContentType(contentType: string, extension: string) {
  if (contentType && contentType !== 'application/octet-stream') {
    return contentType;
  }

  return extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
}

async function createNegotiationEvidenceUploadToken(merchantId: string) {
  const secret = new TextEncoder().encode(getSupabaseJwtSecret());

  return await new SignJWT({
    [NEGOTIATION_EVIDENCE_UPLOAD_CLAIM]: true,
    merchant_id: merchantId,
    role: 'anon',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

export async function POST(request: NextRequest) {
  // Rate limiting is enforced in proxy.ts for this exact API prefix before
  // the route executes; doing it again here would spend two tokens per upload.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid evidence upload request.', 400);
  }

  const parsed = evidenceRequestSchema.safeParse(body);

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

  const supabase = await createClient();
  const { data: merchant, error: merchantError } = await supabase
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

  const scopedJwt = await createNegotiationEvidenceUploadToken(
    parsed.data.merchantId
  );
  const uploadClient = createScopedClient(scopedJwt);
  const { data: signedUpload, error: signedUploadError } =
    await uploadClient.storage
      .from(NEGOTIATION_EVIDENCE_BUCKET)
      .createSignedUploadUrl(evidencePath, {
        upsert: false,
      });

  if (signedUploadError || !signedUpload) {
    return jsonError(
      signedUploadError?.message || 'Failed to initialize evidence upload.',
      500
    );
  }

  return NextResponse.json({
    contentType: getStorageContentType(parsed.data.contentType, extension),
    evidencePath,
    uploadToken: signedUpload.token,
  });
}
