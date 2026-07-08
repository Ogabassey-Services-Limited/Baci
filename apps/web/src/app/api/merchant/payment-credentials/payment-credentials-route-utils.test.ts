import { describe, expect, it } from 'vitest';
import type { MerchantPaymentCredentialMetaRow } from '@/lib/payments/merchant-credentials';
import {
  jsonNoStore,
  toPayPalMode,
  toStatusResponse,
} from './payment-credentials-route-utils';

function metaRow(
  role: MerchantPaymentCredentialMetaRow['credential_role'],
  overrides: Partial<MerchantPaymentCredentialMetaRow> = {}
): MerchantPaymentCredentialMetaRow {
  return {
    credential_role: role,
    disabled_at: null,
    environment: 'live',
    is_active: true,
    key_last4: role === 'secret_key' ? '9999' : '1234',
    last_validated_at: '2026-07-08T12:00:00Z',
    last_validation_error: null,
    ...overrides,
  };
}

describe('payment credentials route utilities', () => {
  it('maps vault metadata to a write-only status response', () => {
    const status = toStatusResponse([
      metaRow('client_id'),
      metaRow('secret_key'),
    ]);

    expect(status).toEqual({
      configured: true,
      roles: [
        {
          role: 'client_id',
          environment: 'live',
          last4: '1234',
          isActive: true,
          lastValidatedAt: '2026-07-08T12:00:00Z',
          lastValidationError: null,
        },
        {
          role: 'secret_key',
          environment: 'live',
          last4: '9999',
          isActive: true,
          lastValidatedAt: '2026-07-08T12:00:00Z',
          lastValidationError: null,
        },
      ],
    });
    expect(JSON.stringify(status)).not.toContain('secret-key');
  });

  it('does not mark inactive secret credentials configured', () => {
    expect(
      toStatusResponse([metaRow('secret_key', { is_active: false })])
    ).toMatchObject({ configured: false });
  });

  it('maps vault environments to PayPal modes', () => {
    expect(toPayPalMode('live')).toBe('live');
    expect(toPayPalMode('test')).toBe('sandbox');
  });

  it('adds private no-store cache headers to JSON responses', () => {
    const response = jsonNoStore({ ok: true });
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
  });
});
