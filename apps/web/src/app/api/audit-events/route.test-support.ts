export function createAuditEvent(
  index: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    action: 'merchant.feature.update',
    actor_label: 'authenticated_user',
    actor_type: 'user',
    actor_user_id: 'b0b0b0b0-2222-4333-8444-555555555555',
    after_values: { paystack_enabled: true },
    before_values: { paystack_enabled: false },
    changed_fields: ['paystack_enabled'],
    correlation_id: 'c0c0c0c0-2222-4333-8444-555555555555',
    database_transaction_id: `tx-${index}`,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    merchant_id: '550e8400-e29b-41d4-a716-446655440000',
    merchant_label: 'Example Store',
    metadata: { category: 'payment' },
    occurred_at: `2026-07-29T12:00:${String(index).padStart(2, '0')}.000Z`,
    request_id: 'd0d0d0d0-2222-4333-8444-555555555555',
    resource_id: 'f0f0f0f0-2222-4333-8444-555555555555',
    resource_type: 'merchant_feature_settings',
    schema_version: 1,
    source: 'api',
    ...overrides,
  };
}
