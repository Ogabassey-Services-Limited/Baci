import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { createServiceClient } from '@/lib/supabase/service';

type ExpiredPendingUpload = {
  client_upload_id: string;
  id: string;
  merchant_id: string;
  storage_path: string;
};

function hasValidCronSecret(request: Request) {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${cronSecret}`;

  return Boolean(authHeader && constantTimeEqual(authHeader, expectedToken));
}

export async function GET(request: NextRequest) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('pending_import_uploads')
    .select('id, merchant_id, client_upload_id, storage_path')
    .is('claimed_at', null)
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Pending import upload cleanup query failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let cleaned = 0;
  for (const upload of (data || []) as ExpiredPendingUpload[]) {
    const existingJob = await supabase
      .from('import_jobs')
      .select('id')
      .eq('merchant_id', upload.merchant_id)
      .eq('client_upload_id', upload.client_upload_id)
      .maybeSingle();

    if (existingJob.error) {
      console.error(
        'Pending import upload job lookup failed:',
        existingJob.error
      );
      continue;
    }

    if (existingJob.data) {
      const deletePendingRow = await supabase
        .from('pending_import_uploads')
        .delete()
        .eq('id', upload.id);

      if (!deletePendingRow.error) {
        cleaned += 1;
      }
      continue;
    }

    const storage = supabase.storage.from('migration-imports');
    const existsResult = await storage.exists(upload.storage_path);
    if (existsResult.error) {
      console.error(
        'Pending import upload existence check failed:',
        existsResult.error
      );
      continue;
    }

    if (existsResult.data) {
      const removeResult = await storage.remove([upload.storage_path]);
      if (removeResult.error) {
        console.error(
          'Pending import upload removal failed:',
          removeResult.error
        );
        continue;
      }
    }

    const deletePendingRow = await supabase
      .from('pending_import_uploads')
      .delete()
      .eq('id', upload.id);

    if (deletePendingRow.error) {
      console.error(
        'Pending import upload record deletion failed:',
        deletePendingRow.error
      );
      continue;
    }

    cleaned += 1;
  }

  return NextResponse.json({ cleaned });
}
