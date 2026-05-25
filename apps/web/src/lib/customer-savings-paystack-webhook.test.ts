import { describe, expect, it, vi } from 'vitest';
import type { SavingsAutoDebitDatabaseClient } from './customer-savings-auto-debit-types';
import {
  createVerifiedPaystackWebhookSignature,
  handlePaystackSavingsWebhookTransaction,
} from './customer-savings-paystack-webhook';

const verifiedPaystackSignature = createVerifiedPaystackWebhookSignature(true);

describe('handlePaystackSavingsWebhookTransaction', () => {
  it('applies an auto-debit webhook through wallet credit then savings allocation', async () => {
    const creditWalletTopUpFn = vi.fn().mockResolvedValue({
      balance: 20000,
      reference: 'SVG-11111111-2026-05-21',
      transactionId: 'wallet-credit-1',
    });
    const supabase = {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            contribution_id: 'contribution-1',
            goal_current_amount: '120000',
            goal_status: 'active',
            success: true,
            wallet_balance: '0',
            wallet_transaction_id: 'wallet-debit-1',
          },
        ],
        error: null,
      }),
    };

    const result = await handlePaystackSavingsWebhookTransaction({
      creditWalletTopUpFn,
      gatewayResponse: {},
      paystackSignature: verifiedPaystackSignature,
      reference: 'SVG-11111111-2026-05-21',
      supabase: supabase as unknown as SavingsAutoDebitDatabaseClient,
      transaction: {
        amount: '20000',
        id: 'txn-1',
        merchant_id: 'merchant-1',
        metadata: {
          customer_id: 'customer-1',
          goal_id: '11111111-1111-4111-8111-111111111111',
          idempotency_key:
            'savings:11111111-1111-4111-8111-111111111111:2026-05-21',
          transaction_type: 'savings_auto_debit',
        },
      },
    });

    expect(result).toEqual({
      body: {
        contributionId: 'contribution-1',
        message: 'Savings auto-debit applied',
        reference: 'SVG-11111111-2026-05-21',
      },
      handled: true,
      status: 200,
    });
    expect(creditWalletTopUpFn).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 20000,
        customerId: 'customer-1',
        gateway: 'paystack',
        merchantId: 'merchant-1',
        transactionId: 'txn-1',
      })
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'allocate_customer_savings_contribution',
      expect.objectContaining({
        p_goal_id: '11111111-1111-4111-8111-111111111111',
        p_source_id: 'txn-1',
        p_source_type: 'paystack_authorization',
      })
    );
  });

  it('returns 500 when wallet credit fails before savings allocation', async () => {
    const creditWalletTopUpFn = vi
      .fn()
      .mockRejectedValue(new Error('Wallet credit failed'));
    const supabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    const result = await handlePaystackSavingsWebhookTransaction({
      creditWalletTopUpFn,
      gatewayResponse: {},
      paystackSignature: verifiedPaystackSignature,
      reference: 'SVG-11111111-2026-05-21',
      supabase: supabase as unknown as SavingsAutoDebitDatabaseClient,
      transaction: {
        amount: '20000',
        id: 'txn-1',
        merchant_id: 'merchant-1',
        metadata: {
          customer_id: 'customer-1',
          goal_id: '11111111-1111-4111-8111-111111111111',
          idempotency_key:
            'savings:11111111-1111-4111-8111-111111111111:2026-05-21',
          transaction_type: 'savings_auto_debit',
        },
      },
    });

    expect(result).toEqual({
      body: { error: 'Wallet credit failed' },
      handled: true,
      status: 500,
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns 500 when savings allocation fails after wallet credit', async () => {
    const creditWalletTopUpFn = vi.fn().mockResolvedValue({
      balance: 20000,
      reference: 'SVG-11111111-2026-05-21',
      transactionId: 'wallet-credit-1',
    });
    const supabase = {
      from: vi.fn(),
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'RPC failed' } }),
    };

    const result = await handlePaystackSavingsWebhookTransaction({
      creditWalletTopUpFn,
      gatewayResponse: {},
      paystackSignature: verifiedPaystackSignature,
      reference: 'SVG-11111111-2026-05-21',
      supabase: supabase as unknown as SavingsAutoDebitDatabaseClient,
      transaction: {
        amount: '20000',
        id: 'txn-1',
        merchant_id: 'merchant-1',
        metadata: {
          customer_id: 'customer-1',
          goal_id: '11111111-1111-4111-8111-111111111111',
          idempotency_key:
            'savings:11111111-1111-4111-8111-111111111111:2026-05-21',
          transaction_type: 'savings_auto_debit',
        },
      },
    });

    expect(result).toEqual({
      body: { error: 'RPC failed' },
      handled: true,
      status: 500,
    });
  });

  it('returns the existing contribution id for idempotent allocation conflicts', async () => {
    const creditWalletTopUpFn = vi.fn().mockResolvedValue({
      balance: 20000,
      reference: 'SVG-11111111-2026-05-21',
      transactionId: 'wallet-credit-1',
    });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'existing-contribution-1' },
      error: null,
    });
    const contributionQuery = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
      select: vi.fn().mockReturnThis(),
    };
    const supabase = {
      from: vi.fn().mockReturnValue(contributionQuery),
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'duplicate idempotency key' },
      }),
    };

    const result = await handlePaystackSavingsWebhookTransaction({
      creditWalletTopUpFn,
      gatewayResponse: {},
      paystackSignature: verifiedPaystackSignature,
      reference: 'SVG-11111111-2026-05-21',
      supabase: supabase as unknown as SavingsAutoDebitDatabaseClient,
      transaction: {
        amount: '20000',
        id: 'txn-1',
        merchant_id: 'merchant-1',
        metadata: {
          customer_id: 'customer-1',
          goal_id: '11111111-1111-4111-8111-111111111111',
          idempotency_key:
            'savings:11111111-1111-4111-8111-111111111111:2026-05-21',
          transaction_type: 'savings_auto_debit',
        },
      },
    });

    expect(result?.body.contributionId).toBe('existing-contribution-1');
    expect(supabase.from).toHaveBeenCalledWith(
      'customer_savings_contributions'
    );
    expect(contributionQuery.eq).toHaveBeenCalledWith(
      'idempotency_key',
      'savings:11111111-1111-4111-8111-111111111111:2026-05-21'
    );
  });
});
