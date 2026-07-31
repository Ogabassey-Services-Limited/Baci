import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { auditEventQuerySchema } from '@/schemas/audit-event-query';
import type { Database } from '@/types/supabase';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
} as const;
const EMAIL_ADDRESS_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;

type AuditEventRow =
  Database['public']['Functions']['list_merchant_audit_events_v1']['Returns'][number];

function jsonNoStore(
  body: Parameters<typeof NextResponse.json>[0],
  init?: Parameters<typeof NextResponse.json>[1]
) {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
    headers.set(name, value);
  }
  return NextResponse.json(body, { ...init, headers });
}

function toNonPiiLabel(label: string | null) {
  return label && EMAIL_ADDRESS_PATTERN.test(label) ? null : label;
}

function toAuditEventResponse(event: AuditEventRow) {
  return {
    action: event.action,
    actorLabel: toNonPiiLabel(event.actor_label),
    actorType: event.actor_type,
    actorUserId: event.actor_user_id,
    afterValues: event.after_values,
    beforeValues: event.before_values,
    changedFields: event.changed_fields,
    correlationId: event.correlation_id,
    databaseTransactionId: event.database_transaction_id,
    id: event.id,
    merchantId: event.merchant_id,
    merchantLabel: toNonPiiLabel(event.merchant_label),
    metadata: event.metadata,
    occurredAt: event.occurred_at,
    requestId: event.request_id,
    resourceId: event.resource_id,
    resourceType: event.resource_type,
    schemaVersion: event.schema_version,
    source: event.source,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    }

    noStore();

    const searchParams = request.nextUrl.searchParams;
    const hasDuplicateQueryParam = Array.from(searchParams.keys()).some(
      (key) => searchParams.getAll(key).length > 1
    );
    if (hasDuplicateQueryParam) {
      return jsonNoStore(
        {
          code: 'invalid_audit_event_query',
          error: 'Invalid audit event query',
        },
        { status: 400 }
      );
    }

    const query = auditEventQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );
    if (!query.success) {
      return jsonNoStore(
        {
          code: 'invalid_audit_event_query',
          error: 'Invalid audit event query',
        },
        { status: 400 }
      );
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: query.data.merchantId,
    });
    const isSelectedMerchantOwner =
      merchantContext?.staffAccess.isOwner &&
      merchantContext.merchantId.toLowerCase() ===
        query.data.merchantId.toLowerCase();
    if (!isSelectedMerchantOwner) {
      return jsonNoStore({ error: 'Forbidden' }, { status: 403 });
    }

    const auditEventClient = supabase as unknown as SupabaseClient<Database>;
    const { data, error } = await auditEventClient.rpc(
      'list_merchant_audit_events_v1',
      {
        p_action: query.data.action,
        p_before_id: query.data.cursorId,
        p_before_occurred_at: query.data.cursorOccurredAt,
        p_limit: query.data.limit + 1,
        p_merchant_id: query.data.merchantId,
        p_resource_type: query.data.resourceType,
      }
    );

    if (error) {
      return jsonNoStore(
        {
          code: 'audit_events_unavailable',
          error: 'Unable to load audit events',
        },
        { status: 500 }
      );
    }

    const rows = data ?? [];
    const pageRows = rows.slice(0, query.data.limit);
    const lastRow = pageRows.at(-1);
    const nextCursor =
      rows.length > query.data.limit && lastRow
        ? {
            cursorId: lastRow.id,
            cursorOccurredAt: lastRow.occurred_at,
          }
        : null;

    return jsonNoStore({
      events: pageRows.map(toAuditEventResponse),
      nextCursor,
    });
  } catch {
    return jsonNoStore(
      {
        code: 'audit_events_unavailable',
        error: 'Unable to load audit events',
      },
      { status: 500 }
    );
  }
}
