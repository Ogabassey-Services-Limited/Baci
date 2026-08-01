import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { isBaciPaystackSettlementCountry } from '@/lib/checkout/payment-gateway-availability';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import {
  compareCACData,
  extractCACCertificateData,
} from '@/lib/verify-cac-certificate';
import { cacVerifyFormSchema } from '@/schemas/verification';
import { hasCacFileSignature } from '../cac-file-signature';
import { getVerificationRateLimitError } from '../verification-rate-limit';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_MULTIPART_CONTENT_LENGTH = MAX_FILE_SIZE + 64 * 1024;
const CAC_IDENTITY_CONFLICT_SQLSTATE = 'PT409';

function isCacIdentityConflictError(
  error: unknown
): error is { code: string; details?: string; message?: string } {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const code = Reflect.get(error, 'code');
  return typeof code === 'string' && code === CAC_IDENTITY_CONFLICT_SQLSTATE;
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

function hasOversizedContentLength(request: NextRequest): boolean {
  const rawContentLength = request.headers.get('content-length');
  if (!rawContentLength) return false;

  const contentLength = Number(rawContentLength);
  return (
    Number.isFinite(contentLength) &&
    contentLength > MAX_MULTIPART_CONTENT_LENGTH
  );
}

async function removeStorageFile(
  supabase: NonNullable<
    Awaited<ReturnType<typeof authenticateApiRequest>>['supabase']
  >,
  path: string
): Promise<void> {
  const { error } = await supabase.storage.from('kyc-documents').remove([path]);
  if (error) {
    console.warn('Failed to cleanup KYC document:', error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error ?? 'Unauthorized' },
      { status: 401 }
    );
  }

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  if (hasOversizedContentLength(request)) {
    return NextResponse.json(
      { error: 'File exceeds maximum size of 5MB' },
      { status: 413 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }

  const mimeType = file.type;
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return NextResponse.json(
      {
        error: 'Invalid file type. Allowed types: JPEG, PNG, WebP, PDF',
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File exceeds maximum size of 5MB' },
      { status: 400 }
    );
  }

  const rcNumber = formData.get('rcNumber');
  const approvedName = formData.get('approvedName');

  const merchantId = formData.get('merchantId');
  const parsed = cacVerifyFormSchema.safeParse({
    rcNumber,
    approvedName,
    merchantId,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'validation_error' },
      { status: 400 }
    );
  }

  const fileBuffer = await file
    .arrayBuffer()
    .then((buffer) => new Uint8Array(buffer))
    .catch(() => null);
  if (!fileBuffer) {
    return NextResponse.json({ error: 'Invalid file data' }, { status: 400 });
  }
  if (!hasCacFileSignature(fileBuffer, mimeType)) {
    return NextResponse.json(
      { error: 'File content does not match declared type' },
      { status: 400 }
    );
  }

  const merchantContext = await getMerchantForApiRequest(
    auth.supabase,
    auth.user.id,
    { requestedMerchantId: parsed.data.merchantId }
  );
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }
  if (!merchantContext.staffAccess.isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: merchantRecord, error: merchantError } = await auth.supabase
    .from('merchants')
    .select('country')
    .eq('id', merchantContext.merchantId)
    .maybeSingle();
  if (merchantError) {
    console.error('verify-cac: failed to load merchant country', merchantError);
    return NextResponse.json(
      { error: 'Unable to load merchant verification details' },
      { status: 500 }
    );
  }
  if (!merchantRecord) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }
  if (!isBaciPaystackSettlementCountry(merchantRecord.country)) {
    return NextResponse.json(
      { error: 'CAC verification is only available for Nigerian merchants' },
      { status: 400 }
    );
  }

  const preflightRateLimitError = await getVerificationRateLimitError(
    auth.supabase,
    auth.user.id,
    'verify-cac-preflight',
    30
  );
  if (preflightRateLimitError) return preflightRateLimitError;

  let storagePath: string | undefined;
  try {
    const providerRateLimitError = await getVerificationRateLimitError(
      auth.supabase,
      auth.user.id,
      'verify-cac',
      3
    );
    if (providerRateLimitError) return providerRateLimitError;

    const ext = getExtension(mimeType);
    storagePath = `${merchantContext.merchantId}/cac-${Date.now()}.${ext}`;

    const { error: uploadError } = await auth.supabase.storage
      .from('kyc-documents')
      .upload(storagePath, fileBuffer, { contentType: mimeType });

    if (uploadError) {
      console.error('KYC upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload document' },
        { status: 500 }
      );
    }

    let extracted: Awaited<ReturnType<typeof extractCACCertificateData>>;
    try {
      extracted = await extractCACCertificateData(fileBuffer, mimeType);
    } catch (extractErr) {
      console.error('CAC extraction error:', extractErr);
      await removeStorageFile(auth.supabase, storagePath);
      return NextResponse.json(
        { error: 'Failed to extract certificate data' },
        { status: 500 }
      );
    }

    const { match, reason } = compareCACData(
      extracted,
      parsed.data.rcNumber,
      parsed.data.approvedName
    );

    if (match) {
      const { error: rpcError } = await auth.supabase.rpc(
        'record_cac_verification',
        {
          p_merchant_id: merchantContext.merchantId,
          p_cac_certificate_path: storagePath,
          p_cac_approved_name: parsed.data.approvedName,
          p_rc_number: parsed.data.rcNumber,
        }
      );

      if (rpcError) {
        console.error('record_cac_verification error:', rpcError);
        await removeStorageFile(auth.supabase, storagePath);

        if (isCacIdentityConflictError(rpcError)) {
          return NextResponse.json(
            {
              code: 'CAC_IDENTITY_CONFLICT',
              error: 'CAC identity conflict',
              details:
                rpcError.details ||
                'CAC verification would overwrite an existing, different legal identity for this merchant.',
            },
            { status: 409 }
          );
        }

        return NextResponse.json(
          { error: 'Failed to record verification' },
          { status: 500 }
        );
      }
    } else {
      // Certificate didn't match — remove the uploaded file
      await removeStorageFile(auth.supabase, storagePath);
    }

    return NextResponse.json({
      verified: match,
      ...(reason ? { reason } : {}),
    });
  } catch (err) {
    console.error('verify-cac error:', err);
    if (storagePath) {
      await removeStorageFile(auth.supabase, storagePath);
    }
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
