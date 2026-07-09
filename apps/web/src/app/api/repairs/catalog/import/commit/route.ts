import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { revalidateRepairsCatalog } from '@/lib/cache-revalidation';
import { logger } from '@/lib/logger';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import {
  commitImportRows,
  type ImportCommitCounts,
} from '@/lib/repairs/import-commit';
import { createImportCommitRepository } from '@/lib/repairs/import-commit-repository';
import { repairImportCommitSchema } from '@/schemas/repair-catalog-admin';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authz = await authorizeRepairsRequest(request, 'edit');
  if (!authz.ok) {
    return authz.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = repairImportCommitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const repository = createImportCommitRepository(
    authz.supabase,
    authz.access.merchantId
  );

  // commitImportRows is NOT transactional: it writes service types, devices and
  // quotes across separate statements, so a mid-batch failure can leave a
  // partial write. Surface that explicitly (structured code + logged context)
  // rather than implying the whole catalogue saved.
  let counts: ImportCommitCounts;
  try {
    counts = await commitImportRows(parsed.data.rows, repository);
  } catch (error) {
    logger.error({
      message:
        'repairs import commit failed (catalogue may be partially saved)',
      merchantId: authz.access.merchantId,
      rowCount: parsed.data.rows.length,
      error,
    });
    return NextResponse.json(
      {
        error:
          'Failed to save the catalogue. Some rows may not have been saved — review your catalogue and retry.',
        code: 'import_commit_failed',
      },
      { status: 500 }
    );
  }

  revalidatePath('/dashboard/repairs');
  revalidateRepairsCatalog(authz.access.merchantId);
  return NextResponse.json({ counts });
}
