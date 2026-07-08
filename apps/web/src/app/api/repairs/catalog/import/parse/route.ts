import { type NextRequest, NextResponse } from 'next/server';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import { loadImportMatchContext } from '@/lib/repairs/import-context';
import {
  parseRepairPriceList,
  RepairsImportUnavailableError,
} from '@/lib/repairs/import-gemma';
import {
  type ImportMatchContext,
  matchImportRows,
} from '@/lib/repairs/import-match';
import type { ParsedRepairRow } from '@/lib/repairs/import-parse';
import { repairImportParseSchema } from '@/schemas/repair-catalog-admin';

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

  const parsed = repairImportParseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let rows: ParsedRepairRow[];
  try {
    rows = await parseRepairPriceList(parsed.data.text);
  } catch (error) {
    if (error instanceof RepairsImportUnavailableError) {
      return NextResponse.json(
        { error: 'AI import is not configured' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to read the price list' },
      { status: 502 }
    );
  }

  let context: ImportMatchContext;
  try {
    context = await loadImportMatchContext(
      authz.supabase,
      authz.access.merchantId
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to match against your catalogue' },
      { status: 500 }
    );
  }

  return NextResponse.json({ rows: matchImportRows(rows, context) });
}
