import {
  normalizeOrderEditChangeCategory,
  type OrderAuditEventContract,
} from '@baci/shared';
import { useQuery } from '@tanstack/react-query';
import { getBranchScopeKey } from '@/lib/branch-scope-query';
import { supabase } from '@/lib/supabase';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import { useBranchScope } from '../useBranchScope';

export interface OrderAuditEvent extends OrderAuditEventContract {
  actor_user_id: string | null;
  created_at: string;
  id: string;
}

const ORDER_AUDIT_EVENT_COLUMNS =
  'id, actor_user_id, changed_fields, change_category, created_at';

function normalizeOrderAuditEvent(row: unknown): OrderAuditEvent | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const record = row as Record<string, unknown>;
  if (typeof record.id !== 'string') {
    return null;
  }

  return {
    actor_user_id:
      typeof record.actor_user_id === 'string' ? record.actor_user_id : null,
    change_category:
      normalizeOrderEditChangeCategory(record.change_category) ?? 'internal',
    changed_fields: Array.isArray(record.changed_fields)
      ? record.changed_fields.filter(
          (field): field is string => typeof field === 'string'
        )
      : [],
    created_at: typeof record.created_at === 'string' ? record.created_at : '',
    id: record.id,
  };
}

export async function fetchOrderAuditEvents(
  orderId: string,
  merchantId: string,
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<OrderAuditEvent[]> {
  let query = supabase
    .from('order_audit_events')
    .select(
      scope.type === 'branch'
        ? `${ORDER_AUDIT_EVENT_COLUMNS}, orders!inner(branch_id)`
        : ORDER_AUDIT_EVENT_COLUMNS
    )
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId);

  if (scope.type === 'branch') {
    query = query.eq('orders.branch_id', scope.branchId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).flatMap((row) => {
    const event = normalizeOrderAuditEvent(row);
    return event ? [event] : [];
  });
}

export function useOrderAuditEvents({
  merchantId,
  orderId,
}: {
  merchantId?: string | null;
  orderId?: string | null;
}) {
  const { scope } = useBranchScope();
  const branchScopeKey = getBranchScopeKey(scope);

  return useQuery({
    enabled: Boolean(orderId && merchantId),
    queryFn: () => {
      if (!orderId || !merchantId) {
        return Promise.resolve([]);
      }

      return fetchOrderAuditEvents(orderId, merchantId, scope);
    },
    queryKey: ['order-audit-events', orderId, merchantId, branchScopeKey],
    staleTime: 60_000,
  });
}
