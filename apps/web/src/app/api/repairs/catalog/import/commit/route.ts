import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
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

  let counts: ImportCommitCounts;
  try {
    counts = await commitImportRows(parsed.data.rows, repository);
  } catch {
    return NextResponse.json(
      { error: 'Failed to save the catalogue' },
      { status: 500 }
    );
  }

  revalidatePath('/dashboard/repairs');
  return NextResponse.json({ counts });
}
