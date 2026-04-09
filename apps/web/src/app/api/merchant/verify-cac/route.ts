import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  compareCACData,
  extractCACCertificateData,
} from '@/lib/verify-cac-certificate';
import { cacVerifyFormSchema } from '@/schemas/verification';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (!access.isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allowed = await checkRateLimit(
    auth.supabase,
    auth.user.id,
    'verify-cac',
    3,
    1
  );
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', code: 'rate_limited' },
      { status: 429 }
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

  const parsed = cacVerifyFormSchema.safeParse({ rcNumber, approvedName });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let storagePath: string | undefined;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const ext = getExtension(mimeType);
    storagePath = `${access.merchantId}/cac-${Date.now()}.${ext}`;

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
      await auth.supabase.storage.from('kyc-documents').remove([storagePath]);
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
          p_merchant_id: access.merchantId,
          p_cac_certificate_path: storagePath,
          p_cac_approved_name: parsed.data.approvedName,
          p_rc_number: parsed.data.rcNumber,
        }
      );

      if (rpcError) {
        console.error('record_cac_verification error:', rpcError);
        return NextResponse.json(
          { error: 'Failed to record verification' },
          { status: 500 }
        );
      }
    } else {
      // Certificate didn't match — remove the uploaded file
      await auth.supabase.storage.from('kyc-documents').remove([storagePath]);
    }

    return NextResponse.json({
      verified: match,
      ...(reason ? { reason } : {}),
    });
  } catch (err) {
    console.error('verify-cac error:', err);
    if (storagePath) {
      await auth.supabase.storage.from('kyc-documents').remove([storagePath]);
    }
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
