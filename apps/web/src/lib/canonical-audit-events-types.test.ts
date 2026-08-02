import { describe, expectTypeOf, it } from 'vitest';
import type { Database } from '@/types/supabase';

type AuditEventRow = Database['public']['Tables']['audit_events']['Row'];
type AuditReaderArgs =
  Database['public']['Functions']['list_merchant_audit_events_v1']['Args'];
type AuditReaderRow =
  Database['public']['Functions']['list_merchant_audit_events_v1']['Returns'][number];

describe('canonical audit event generated types', () => {
  it('keeps cursor and filter arguments optional while merchant and limit stay required', () => {
    expectTypeOf<AuditEventRow['id']>().toEqualTypeOf<string>();
    expectTypeOf<
      AuditEventRow['database_transaction_id']
    >().toEqualTypeOf<string>();
    expectTypeOf<AuditReaderRow['id']>().toEqualTypeOf<string>();
    expectTypeOf<
      AuditReaderRow['database_transaction_id']
    >().toEqualTypeOf<string>();
    expectTypeOf<AuditReaderArgs>().toEqualTypeOf<{
      p_action?: string;
      p_before_id?: string;
      p_before_occurred_at?: string;
      p_limit: number;
      p_merchant_id: string;
      p_resource_type?: string;
    }>();
  });
});
