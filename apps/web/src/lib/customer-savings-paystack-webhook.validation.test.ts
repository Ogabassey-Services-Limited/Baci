import { describe, expect, it, vi } from 'vitest';
import type { SavingsAutoDebitDatabaseClient } from './customer-savings-auto-debit-types';
import {
  createVerifiedPaystackWebhookSignature,
  handlePaystackSavingsWebhookTransaction,
} from './customer-savings-paystack-webhook';

const verifiedPaystackSignature = createVerifiedPaystackWebhookSignature(true);

describe('handlePaystackSavingsWebhookTransaction validation', () => {
  it('returns null for unrelated transactions', async () => {
    const result = await handlePaystackSavingsWebhookTransaction({
      gatewayResponse: {},
      paystackSignature: null,
      reference: 'REF-1',
      supabase: {
        from: vi.fn(),
        rpc: vi.fn(),
      } as unknown as SavingsAutoDebitDatabaseClient,
      transaction: {
        amount: '1000',
        id: 'txn-1',
        merchant_id: 'merchant-1',
        metadata: { transaction_type: 'wallet_topup' },
      },
    });

    expect(result).toBeNull();
  });

  it('returns 400 when an authorization charge has no accounting policy', async () => {
    const upsertAuthorizationFn = vi.fn().mockResolvedValue('method-1');

    const result = await handlePaystackSavingsWebhookTransaction({
      creditWalletTopUpFn: vi.fn().mockResolvedValue({
        balance: 100,
        reference: 'SAV-AUTH-1',
        transactionId: 'wallet-credit-1',
      }),
      gatewayResponse: {
        authorization: {
          authorization_code: 'AUTH_1',
          bank: 'Test Bank',
          card_type: 'visa',
          country_code: 'NG',
          exp_month: '12',
          exp_year: '2030',
          last4: '4242',
          reusable: true,
          signature: 'sig-1',
        },
      },
      paystackSignature: verifiedPaystackSignature,
      reference: 'SAV-AUTH-1',
      supabase: {
        from: vi.fn(),
        rpc: vi.fn(),
      } as unknown as SavingsAutoDebitDatabaseClient,
      transaction: {
        amount: '100',
        id: 'txn-1',
        merchant_id: 'merchant-1',
        metadata: {
          customer_email: 'jane@example.com',
          customer_id: 'customer-1',
          transaction_type: 'savings_authorization',
        },
      },
      upsertAuthorizationFn,
    });

    expect(upsertAuthorizationFn).toHaveBeenCalled();
    expect(result).toEqual({
      body: { error: 'Savings authorization accounting policy missing' },
      handled: true,
      status: 400,
    });
  });

  it('does not upsert malformed Paystack authorization payloads', async () => {
    const upsertAuthorizationFn = vi.fn().mockResolvedValue('method-1');

    const result = await handlePaystackSavingsWebhookTransaction({
      creditWalletTopUpFn: vi.fn().mockResolvedValue({
        balance: 100,
        reference: 'SAV-AUTH-1',
        transactionId: 'wallet-credit-1',
      }),
      gatewayResponse: {
        authorization: {
          authorization_code: 42,
          reusable: true,
          signature: 'sig-1',
        },
      },
      paystackSignature: verifiedPaystackSignature,
      reference: 'SAV-AUTH-1',
      supabase: {
        from: vi.fn(),
        rpc: vi.fn(),
      } as unknown as SavingsAutoDebitDatabaseClient,
      transaction: {
        amount: '100',
        id: 'txn-1',
        merchant_id: 'merchant-1',
        metadata: {
          customer_email: 'jane@example.com',
          customer_id: 'customer-1',
          savings_accounting_policy: 'credit_wallet',
          transaction_type: 'savings_authorization',
        },
      },
      upsertAuthorizationFn,
    });

    expect(upsertAuthorizationFn).not.toHaveBeenCalled();
    expect(result?.status).toBe(200);
  });

  it('rejects savings side effects without a verified Paystack signature', async () => {
    const creditWalletTopUpFn = vi.fn();
    const supabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    const result = await handlePaystackSavingsWebhookTransaction({
      creditWalletTopUpFn,
      gatewayResponse: {},
      paystackSignature: null,
      reference: 'SVG-11111111-2026-05-21',
      supabase: supabase as unknown as SavingsAutoDebitDatabaseClient,
      transaction: {
        amount: '20000',
        id: 'txn-1',
        merchant_id: 'merchant-1',
        metadata: {
          customer_id: 'customer-1',
          goal_id: '11111111-1111-4111-8111-111111111111',
          transaction_type: 'savings_auto_debit',
        },
      },
    });

    expect(result).toEqual({
      body: { error: 'Verified Paystack signature is required' },
      handled: true,
      status: 401,
    });
    expect(creditWalletTopUpFn).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
