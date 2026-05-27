import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticRequestAccess } from '@/lib/agentic/agent-request-controls';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import {
  type AgenticMerchantContext,
  resolveAgenticMerchantContext,
} from '@/lib/agentic/merchant-context';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import {
  buildUcpCatalogProductsResponse,
  filterActiveUcpCatalogProductRows,
  mapUcpCatalogProductRow,
  UCP_CATALOG_SEARCH_CAPABILITY,
  type UcpCatalogProductRow,
} from '@/lib/agentic/ucp-catalog-adapters';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { ucpCatalogSearchRequestSchema } from '@/schemas/ucp-catalog-request';

const CATALOG_CURRENCY = 'NGN';
const PRODUCT_SELECT =
  'id, merchant_id, name, description, price, images, slug, stock, stock_quantity, manage_stock, status, category, created_at';

export async function POST(request: NextRequest) {
  if (!verifyAgenticApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return body.response;
  }
  const parsed = ucpCatalogSearchRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const context = await resolveCatalogContext(request);
  if (!context.ok) {
    return context.response;
  }

  let query = context.supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('merchant_id', context.merchant.id)
    .eq('status', 'active');

  if (parsed.data.query) {
    const escapedQuery = escapeLikePattern(parsed.data.query.slice(0, 100));
    query = query.or(
      `name.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%`
    );
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(parsed.data.pagination?.limit ?? 20);
  if (error) {
    return NextResponse.json(
      { error: 'Catalog search failed' },
      { status: 500 }
    );
  }

  const baseUrl = buildRequestScopedStoreUrl(context.merchant, request.headers);
  const products = filterActiveUcpCatalogProductRows(
    (data ?? []) as UcpCatalogProductRow[]
  ).map((row) =>
    mapUcpCatalogProductRow({
      baseUrl,
      currency: CATALOG_CURRENCY,
      row,
    })
  );

  return NextResponse.json(
    buildUcpCatalogProductsResponse({
      capability: UCP_CATALOG_SEARCH_CAPABILITY,
      products,
    })
  );
}

async function resolveCatalogContext(
  request: NextRequest
): Promise<
  | { ok: true; merchant: AgenticMerchantContext; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }
> {
  const merchant = await resolveAgenticMerchantContext(createAdminClient());
  if (!merchant) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Agentic merchant not found' },
        { status: 500 }
      ),
    };
  }
  const agentAccess = verifyAgenticRequestAccess({
    controls: {
      allowlist: merchant.agent_user_agent_allowlist ?? [],
      denylist: merchant.agent_user_agent_denylist ?? [],
    },
    headers: request.headers,
  });
  if (!agentAccess.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: agentAccess.error },
        { status: 403 }
      ),
    };
  }

  return {
    merchant,
    ok: true,
    supabase: createAgenticScopedSupabaseClient({
      merchantId: merchant.id,
      merchantSlug: merchant.slug,
    }),
  };
}

async function readJsonBody(
  request: NextRequest
): Promise<
  { ok: true; value: unknown } | { ok: false; response: NextResponse }
> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      ),
    };
  }
}

function escapeLikePattern(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}
