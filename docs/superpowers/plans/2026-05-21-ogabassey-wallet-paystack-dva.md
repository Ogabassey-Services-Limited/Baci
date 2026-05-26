# Ogabassey Wallet Paystack DVA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Ogabassey customer wallet top-ups that currently use regular Paystack Checkout with a permanent Paystack Dedicated Virtual Account (DVA) per customer, so bank-transfer wallet funding uses Paystack DVA pricing and credits the existing wallet ledger idempotently.

**Architecture:** Add a server-owned `customer_wallet_payment_accounts` table keyed by merchant, customer, and provider. Expose an authenticated wallet funding-account API that creates or reuses the customer's Paystack DVA, then display that account in the Ogabassey wallet UI. Extend the existing Paystack webhook DVA chain to match incoming `charge.success` events by receiver account number, insert or reuse a `transactions` row with `metadata.transaction_type = 'wallet_topup'`, and let the existing wallet credit helper finish the ledger update.

**Tech Stack:** Next.js 16 App Router API routes, TypeScript, Supabase Postgres/RLS/RPC, Paystack Dedicated Virtual Accounts, Vitest, Expo React Native, React Native Testing Library.

---

## Context And Constraints

- The production incident on 2026-05-20 proved the current wallet top-up path uses regular Paystack Checkout: the ₦20,000 wallet top-up settled at ₦19,600 because Paystack charged ₦400.
- Paystack DVA pricing is different from regular Checkout. The target behavior is customer wallet bank-transfer funding through a customer-specific Paystack DVA.
- Paystack DVAs are tied to a Paystack customer and require customer name and phone details. Paystack's DVA docs also call out express customer consent and a default DVA account limit, so the UI must make the account generation/funding action deliberate.
- Existing wallet crediting must remain the source of truth:
  - `apps/web/src/lib/customer-wallet-top-up.ts`
  - `public.credit_customer_wallet(...)`
  - `customer_wallet_transactions.source_type = 'wallet_topup'`
  - `customer_wallet_transactions.source_id = transactions.id`
- Existing DVA webhook hardening for orders must not regress:
  - `apps/web/src/lib/agentic/paystack-dva-webhook.ts`
  - `apps/web/src/lib/payments/confirm-paystack-dva-by-order-account.ts`
  - `apps/web/src/app/api/payments/webhook/route.ts`
- Do not edit existing migrations. Add an append-only migration.
- Do not modify `apps/web/src/proxy.ts`.

## File Structure

- Create `supabase/migrations/20260521120000_customer_wallet_paystack_dva.sql`
  - Adds `customer_wallet_payment_accounts`, indexes, RLS, and updated-at trigger.
- Modify `apps/web/src/lib/agentic/paystack.ts`
  - Extend the DVA response type to return `customer_code` while preserving existing callers.
- Create `apps/web/src/lib/customer-wallet-payment-account.ts`
  - Server-only helper to resolve/create a Paystack wallet DVA for a storefront customer.
- Create `apps/web/src/lib/customer-wallet-payment-account.test.ts`
  - Unit tests for DVA reuse, creation, subaccount validation, and response normalization.
- Create `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.ts`
  - Authenticated route that returns the customer wallet funding account.
- Create `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts`
  - API route tests covering auth, CSRF, merchant/customer resolution, reuse, creation, and failures.
- Create `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.ts`
  - Webhook helper that matches Paystack DVA receiver account numbers to wallet funding accounts and creates/reuses a wallet top-up transaction.
- Create `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.test.ts`
  - Unit tests for matching, idempotency, amount/currency validation, and inactive account fallthrough.
- Modify `apps/web/src/app/api/payments/webhook/route.ts`
  - Wire the wallet DVA helper into the Paystack DVA matching chain before order DVA fallback.
- Modify `apps/web/src/app/api/payments/webhook/route.test.ts`
  - Add wallet DVA webhook coverage and replay coverage.
- Create `apps/mobile-storefront/lib/wallet-funding-account.ts`
  - Mobile API client for the funding-account endpoint.
- Create `apps/mobile-storefront/lib/wallet-funding-account.test.ts`
  - Client validation tests.
- Modify `apps/mobile-storefront/app/wallet/index.tsx`
  - Load funding account when the fund panel opens, stop launching regular Checkout for the Paystack DVA path, and refresh wallet after the user returns.
- Modify `apps/mobile-storefront/__tests__/app/wallet/index.test.tsx`
  - Replace the Checkout-launch top-up expectations with funding-account display expectations.
- Modify `apps/mobile-storefront/components/wallet/WalletContent.tsx`
  - Render account number, bank, account name, copy action, and funding guidance in the fund panel.
- Modify `apps/mobile-storefront/components/wallet/WalletContent.test.tsx`
  - Add accessibility and interaction coverage for the funding account panel.
- Modify `apps/web/src/components/storefront/ogabassey/pages/wallet.tsx`
  - Replace the placeholder web wallet funding alert with the same funding-account API display.
- Create or modify `apps/web/src/components/storefront/ogabassey/pages/wallet.test.tsx`
  - Cover account display and failure state on the web wallet screen.

---

### Task 1: Add Customer Wallet Payment Account Storage

**Files:**
- Create: `supabase/migrations/20260521120000_customer_wallet_paystack_dva.sql`

- [ ] **Step 1: Write the append-only migration**

Use this SQL exactly, adjusting only whitespace if the SQL formatter requires it:

```sql
CREATE TABLE IF NOT EXISTS public.customer_wallet_payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_customer_code text,
  account_number text NOT NULL,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'active',
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_wallet_payment_accounts_provider_check
    CHECK (provider = 'paystack'),
  CONSTRAINT customer_wallet_payment_accounts_status_check
    CHECK (status IN ('active', 'inactive', 'failed')),
  CONSTRAINT customer_wallet_payment_accounts_currency_check
    CHECK (currency = upper(currency)),
  CONSTRAINT customer_wallet_payment_accounts_account_number_check
    CHECK (account_number ~ '^[0-9]{6,20}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_customer_wallet_payment_account
  ON public.customer_wallet_payment_accounts (merchant_id, customer_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS unique_customer_wallet_payment_account_number
  ON public.customer_wallet_payment_accounts (provider, account_number);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_payment_accounts_customer
  ON public.customer_wallet_payment_accounts (customer_id, merchant_id);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_payment_accounts_active_account
  ON public.customer_wallet_payment_accounts (provider, account_number)
  WHERE status = 'active';

CREATE TRIGGER update_customer_wallet_payment_accounts_updated_at
  BEFORE UPDATE ON public.customer_wallet_payment_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customer_wallet_payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_wallet_payment_accounts_select_own
  ON public.customer_wallet_payment_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_wallet_payment_accounts.customer_id
        AND c.merchant_id = customer_wallet_payment_accounts.merchant_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY customer_wallet_payment_accounts_service_all
  ON public.customer_wallet_payment_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.customer_wallet_payment_accounts TO authenticated;
GRANT ALL ON public.customer_wallet_payment_accounts TO service_role;

COMMENT ON TABLE public.customer_wallet_payment_accounts IS
  'Permanent customer wallet funding accounts, initially Paystack DVA for Ogabassey wallet top-ups.';

COMMENT ON COLUMN public.customer_wallet_payment_accounts.provider_customer_code IS
  'Paystack customer code used to create or reuse the DVA.';

COMMENT ON COLUMN public.customer_wallet_payment_accounts.provider_response IS
  'Sanitized Paystack DVA response payload for support and reconciliation.';
```

- [ ] **Step 2: Run the migration syntax check**

Run:

```bash
pnpm exec supabase db lint
```

Expected: no SQL parser errors for the new migration.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260521120000_customer_wallet_paystack_dva.sql
git commit -m "feat: add customer wallet payment accounts"
```

---

### Task 2: Return Paystack Customer Code From Existing DVA Helper

**Files:**
- Modify: `apps/web/src/lib/agentic/paystack.ts`
- Modify: `apps/web/src/lib/agentic/paystack.test.ts`

- [ ] **Step 1: Write the failing test**

Add this assertion to the existing DVA creation test in `apps/web/src/lib/agentic/paystack.test.ts`:

```ts
expect(result.customer_code).toBe('CUS_test_customer');
```

The Paystack mock response used by that test must include:

```ts
{
  data: {
    account_name: 'OGABASSEY/ADA LOVELACE',
    account_number: '1234567890',
    bank: { name: 'Wema Bank' },
    currency: 'NGN',
  },
  status: true,
}
```

The customer creation mock must return:

```ts
{
  data: {
    customer_code: 'CUS_test_customer',
  },
  status: true,
}
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/lib/agentic/paystack.test.ts
```

Expected: FAIL because `DVAResponse` does not include `customer_code`.

- [ ] **Step 3: Implement the response extension**

Modify `DVAResponse` in `apps/web/src/lib/agentic/paystack.ts`:

```ts
export interface DVAResponse {
  account_number: string;
  account_name: string;
  bank_name: string;
  currency: string;
  assigned: boolean;
  customer_code: string;
}
```

Then include `customer_code` in the returned object:

```ts
return {
  account_number: res.data.account_number,
  account_name: res.data.account_name,
  bank_name: res.data.bank?.name || res.data.assignment?.bank_name || 'Bank',
  currency: res.data.currency || 'NGN',
  assigned: true,
  customer_code: customerCode,
};
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/lib/agentic/paystack.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/agentic/paystack.ts apps/web/src/lib/agentic/paystack.test.ts
git commit -m "feat: return paystack customer code for dvas"
```

---

### Task 3: Add Server Helper For Wallet Funding Accounts

**Files:**
- Create: `apps/web/src/lib/customer-wallet-payment-account.ts`
- Create: `apps/web/src/lib/customer-wallet-payment-account.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/customer-wallet-payment-account.test.ts` with these cases:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureCustomerWalletPaymentAccount } from './customer-wallet-payment-account';

const mockCreateDedicatedVirtualAccount = vi.fn();

vi.mock('@/lib/agentic/paystack', () => ({
  createDedicatedVirtualAccount: (...args: unknown[]) =>
    mockCreateDedicatedVirtualAccount(...args),
}));

function createQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data, error }),
          }),
        }),
      }),
    }),
  };
}

describe('ensureCustomerWalletPaymentAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDedicatedVirtualAccount.mockResolvedValue({
      account_name: 'OGABASSEY/ADA LOVELACE',
      account_number: '1234567890',
      assigned: true,
      bank_name: 'Wema Bank',
      currency: 'NGN',
      customer_code: 'CUS_test_customer',
    });
  });

  it('returns an existing active Paystack account without creating another DVA', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'customer_wallet_payment_accounts') {
          return createQuery({
            account_name: 'OGABASSEY/ADA LOVELACE',
            account_number: '1234567890',
            bank_name: 'Wema Bank',
            currency: 'NGN',
            id: 'wallet-account-1',
            provider: 'paystack',
          });
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await ensureCustomerWalletPaymentAccount({
      customer: {
        email: 'ada@example.com',
        first_name: 'Ada',
        id: 'customer-1',
        last_name: 'Lovelace',
        phone: '08012345678',
      },
      merchant: {
        id: 'merchant-1',
        paystack_subaccount_code: 'ACCT_123456789012345',
        slug: 'ogabassey',
      },
      supabase: supabase as never,
    });

    expect(result.accountNumber).toBe('1234567890');
    expect(mockCreateDedicatedVirtualAccount).not.toHaveBeenCalled();
  });

  it('creates and stores a Paystack DVA when none exists', async () => {
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            account_name: 'OGABASSEY/ADA LOVELACE',
            account_number: '1234567890',
            bank_name: 'Wema Bank',
            currency: 'NGN',
            id: 'wallet-account-1',
            provider: 'paystack',
          },
          error: null,
        }),
      }),
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'customer_wallet_payment_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            upsert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await ensureCustomerWalletPaymentAccount({
      customer: {
        email: 'ada@example.com',
        first_name: 'Ada',
        id: 'customer-1',
        last_name: 'Lovelace',
        phone: '08012345678',
      },
      merchant: {
        id: 'merchant-1',
        paystack_subaccount_code: 'ACCT_123456789012345',
        slug: 'ogabassey',
      },
      supabase: supabase as never,
    });

    expect(mockCreateDedicatedVirtualAccount).toHaveBeenCalledWith(
      {
        email: 'ada@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone: '08012345678',
      },
      { subaccount: 'ACCT_123456789012345' }
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_number: '1234567890',
        customer_id: 'customer-1',
        merchant_id: 'merchant-1',
        provider: 'paystack',
        provider_customer_code: 'CUS_test_customer',
        status: 'active',
      }),
      { onConflict: 'merchant_id,customer_id,provider' }
    );
    expect(result.accountNumber).toBe('1234567890');
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/lib/customer-wallet-payment-account.test.ts
```

Expected: FAIL because `customer-wallet-payment-account.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `apps/web/src/lib/customer-wallet-payment-account.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createDedicatedVirtualAccount,
  isValidPaystackSubaccountCode,
} from '@/lib/agentic/paystack';

interface WalletFundingMerchant {
  id: string;
  paystack_subaccount_code: string | null;
  slug: string;
}

interface WalletFundingCustomer {
  email: string | null;
  first_name: string | null;
  id: string;
  last_name: string | null;
  phone: string | null;
}

interface WalletFundingAccountRow {
  account_name: string;
  account_number: string;
  bank_name: string;
  currency: string;
  id: string;
  provider: 'paystack';
}

export interface WalletFundingAccount {
  accountName: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  id: string;
  provider: 'paystack';
}

function toWalletFundingAccount(row: WalletFundingAccountRow): WalletFundingAccount {
  return {
    accountName: row.account_name,
    accountNumber: row.account_number,
    bankName: row.bank_name,
    currency: row.currency,
    id: row.id,
    provider: row.provider,
  };
}

function splitName(customer: WalletFundingCustomer) {
  const firstName = customer.first_name?.trim() || 'Customer';
  const lastName = customer.last_name?.trim() || 'User';
  return { firstName, lastName };
}

export async function ensureCustomerWalletPaymentAccount({
  customer,
  merchant,
  supabase,
}: {
  customer: WalletFundingCustomer;
  merchant: WalletFundingMerchant;
  supabase: SupabaseClient;
}): Promise<WalletFundingAccount> {
  if (!customer.email) {
    throw new Error('Customer email is required to create wallet funding account');
  }
  if (!isValidPaystackSubaccountCode(merchant.paystack_subaccount_code)) {
    throw new Error('Paystack subaccount is not configured for wallet funding');
  }

  const { data: existing, error: existingError } = await supabase
    .from('customer_wallet_payment_accounts')
    .select('id, provider, account_number, bank_name, account_name, currency')
    .eq('merchant_id', merchant.id)
    .eq('customer_id', customer.id)
    .eq('provider', 'paystack')
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return toWalletFundingAccount(existing as WalletFundingAccountRow);
  }

  const { firstName, lastName } = splitName(customer);
  const dva = await createDedicatedVirtualAccount(
    {
      email: customer.email,
      first_name: firstName,
      last_name: lastName,
      phone: customer.phone || '00000000000',
    },
    { subaccount: merchant.paystack_subaccount_code }
  );

  const { data: saved, error: saveError } = await supabase
    .from('customer_wallet_payment_accounts')
    .upsert(
      {
        account_name: dva.account_name,
        account_number: dva.account_number,
        bank_name: dva.bank_name,
        currency: dva.currency,
        customer_id: customer.id,
        merchant_id: merchant.id,
        provider: 'paystack',
        provider_customer_code: dva.customer_code,
        provider_response: dva,
        status: 'active',
      },
      { onConflict: 'merchant_id,customer_id,provider' }
    )
    .select('id, provider, account_number, bank_name, account_name, currency')
    .single();

  if (saveError || !saved) {
    throw saveError ?? new Error('Wallet funding account was not saved');
  }

  return toWalletFundingAccount(saved as WalletFundingAccountRow);
}
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/lib/customer-wallet-payment-account.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/customer-wallet-payment-account.ts apps/web/src/lib/customer-wallet-payment-account.test.ts
git commit -m "feat: create customer wallet funding accounts"
```

---

### Task 4: Add Authenticated Wallet Funding Account API

**Files:**
- Create: `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.ts`
- Create: `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts`

- [ ] **Step 1: Write the failing route tests**

Create route tests that assert these behaviors:

```ts
it('returns 401 when unauthenticated', async () => {
  mockAuthenticateApiRequest.mockResolvedValueOnce({
    error: 'Unauthorized',
    user: null,
  });

  const response = await GET(
    new Request('http://localhost/api/storefront/customer/wallet/funding-account?merchantSlug=ogabassey') as never
  );

  expect(response.status).toBe(401);
});

it('returns the customer Paystack wallet funding account', async () => {
  mockEnsureCustomerWalletPaymentAccount.mockResolvedValueOnce({
    accountName: 'OGABASSEY/ADA LOVELACE',
    accountNumber: '1234567890',
    bankName: 'Wema Bank',
    currency: 'NGN',
    id: 'wallet-account-1',
    provider: 'paystack',
  });

  const response = await GET(
    new Request('http://localhost/api/storefront/customer/wallet/funding-account?merchantSlug=ogabassey') as never
  );
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data).toEqual({
    account: {
      accountName: 'OGABASSEY/ADA LOVELACE',
      accountNumber: '1234567890',
      bankName: 'Wema Bank',
      currency: 'NGN',
      provider: 'paystack',
    },
    success: true,
  });
});
```

Mock these dependencies:

```ts
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/customer-wallet-payment-account', () => ({
  ensureCustomerWalletPaymentAccount: (...args: unknown[]) =>
    mockEnsureCustomerWalletPaymentAccount(...args),
}));

vi.mock('@/lib/resolve-wallet-top-up-merchant', () => ({
  resolveWalletTopUpMerchant: (...args: unknown[]) =>
    mockResolveWalletTopUpMerchant(...args),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  resolveVtuCustomer: (...args: unknown[]) => mockResolveVtuCustomer(...args),
}));
```

- [ ] **Step 2: Run the focused route test and verify failure**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the API route**

Create `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { ensureCustomerWalletPaymentAccount } from '@/lib/customer-wallet-payment-account';
import { resolveWalletTopUpMerchant } from '@/lib/resolve-wallet-top-up-merchant';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';

function getOptionalString(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const merchantSlug = getOptionalString(url.searchParams.get('merchantSlug'));
    const merchantId = getOptionalString(url.searchParams.get('merchantId'));

    if (!merchantSlug && !merchantId) {
      return NextResponse.json(
        { error: 'Merchant slug or id is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const merchant = await resolveWalletTopUpMerchant<{
      id: string;
      paystack_subaccount_code: string | null;
      slug: string;
    }>(
      supabase,
      { merchantId, merchantSlug },
      'id, slug, paystack_subaccount_code'
    );

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const customer = await resolveVtuCustomer({
      supabase,
      merchantId: merchant.id,
      user: auth.user,
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer account not found for this storefront' },
        { status: 404 }
      );
    }

    const account = await ensureCustomerWalletPaymentAccount({
      customer,
      merchant,
      supabase,
    });

    return NextResponse.json({
      account: {
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        bankName: account.bankName,
        currency: account.currency,
        provider: account.provider,
      },
      success: true,
    });
  } catch (error) {
    console.error('Wallet funding account error', error);
    return NextResponse.json(
      { error: 'Failed to load wallet funding account' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run the focused route test**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/storefront/customer/wallet/funding-account/route.ts apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts
git commit -m "feat: expose wallet funding account api"
```

---

### Task 5: Match Paystack DVA Webhooks To Wallet Funding Accounts

**Files:**
- Create: `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.ts`
- Create: `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create tests for these cases:

```ts
it('returns none when account number is missing', async () => {
  const result = await confirmPaystackWalletDvaTopUp({
    accountNumber: null,
    gatewayReference: '100026260509110323000058369193',
    paystackResponse: {},
    supabase: {} as never,
    verifiedAmount: { amount: 20000, currency: 'NGN' },
  });

  expect(result).toEqual({ kind: 'none' });
});

it('inserts a pending wallet top-up transaction for a matched funding account', async () => {
  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          amount: '20000.00',
          currency: 'NGN',
          gateway_reference: '100026260509110323000058369193',
          id: 'txn-1',
          merchant_id: 'merchant-1',
          metadata: {
            customer_id: 'customer-1',
            transaction_type: 'wallet_topup',
          },
          order_id: null,
          platform_fee: 0,
        },
        error: null,
      }),
    }),
  });

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'transactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert,
        };
      }
      if (table === 'customer_wallet_payment_accounts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    account_name: 'OGABASSEY/ADA LOVELACE',
                    account_number: '1234567890',
                    bank_name: 'Wema Bank',
                    customer_id: 'customer-1',
                    id: 'wallet-account-1',
                    merchant_id: 'merchant-1',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  const result = await confirmPaystackWalletDvaTopUp({
    accountNumber: '1234567890',
    gatewayReference: '100026260509110323000058369193',
    paystackResponse: {
      customer: { email: 'ada@example.com' },
      paid_at: '2026-05-20T10:36:29.000Z',
    },
    supabase: supabase as never,
    verifiedAmount: { amount: 20000, currency: 'NGN' },
  });

  expect(result.kind).toBe('match');
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({
      amount: '20000',
      gateway: 'paystack',
      gateway_reference: '100026260509110323000058369193',
      merchant_id: 'merchant-1',
      metadata: expect.objectContaining({
        customer_id: 'customer-1',
        transaction_type: 'wallet_topup',
        wallet_account_id: 'wallet-account-1',
      }),
      status: 'pending',
      transaction_type: 'payment',
    })
  );
});
```

- [ ] **Step 2: Run the focused helper test and verify failure**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the helper**

Create `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT,
  type AgenticPaystackDvaTransaction,
  normalizeAgenticPaystackDvaTransaction,
} from '@/lib/agentic/paystack-dva-transaction';
import { WALLET_TOP_UP_TRANSACTION_TYPE } from '@/lib/customer-wallet-top-up';
import { logger } from '@/lib/logger';

type VerifiedAmount = { amount: number; currency?: string };

const PAYSTACK_ACCOUNT_PATTERN = /^\d{6,20}$/;
const POSTGRES_UNIQUE_VIOLATION = '23505';

export type ConfirmPaystackWalletDvaTopUpResult =
  | { kind: 'none' }
  | { kind: 'match'; transaction: AgenticPaystackDvaTransaction };

export async function confirmPaystackWalletDvaTopUp({
  accountNumber,
  gatewayReference,
  paystackResponse,
  supabase,
  verifiedAmount,
}: {
  accountNumber: string | null;
  gatewayReference: string;
  paystackResponse: Record<string, unknown>;
  supabase: SupabaseClient;
  verifiedAmount: VerifiedAmount | null;
}): Promise<ConfirmPaystackWalletDvaTopUpResult> {
  if (!accountNumber || !PAYSTACK_ACCOUNT_PATTERN.test(accountNumber)) {
    return { kind: 'none' };
  }
  if (!verifiedAmount || !Number.isFinite(verifiedAmount.amount)) {
    return { kind: 'none' };
  }
  if (verifiedAmount.currency && verifiedAmount.currency.toUpperCase() !== 'NGN') {
    logger.warn({
      message: 'Wallet DVA payment ignored because currency is not NGN',
      accountNumber,
      currency: verifiedAmount.currency,
      gatewayReference,
    });
    return { kind: 'none' };
  }

  const { data: existingTransaction, error: existingTransactionError } =
    await supabase
      .from('transactions')
      .select(AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT)
      .eq('gateway_reference', gatewayReference)
      .maybeSingle();

  if (existingTransactionError) {
    throw existingTransactionError;
  }
  if (existingTransaction) {
    return {
      kind: 'match',
      transaction: normalizeAgenticPaystackDvaTransaction(existingTransaction),
    };
  }

  const { data: account, error: accountError } = await supabase
    .from('customer_wallet_payment_accounts')
    .select('id, merchant_id, customer_id, account_number, bank_name, account_name')
    .eq('provider', 'paystack')
    .eq('account_number', accountNumber)
    .eq('status', 'active')
    .maybeSingle();

  if (accountError) {
    throw accountError;
  }
  if (!account) {
    return { kind: 'none' };
  }

  const accountRow = account as {
    account_name: string;
    account_number: string;
    bank_name: string;
    customer_id: string;
    id: string;
    merchant_id: string;
  };

  const paidAt =
    typeof paystackResponse.paid_at === 'string' ? paystackResponse.paid_at : null;
  const customer =
    paystackResponse.customer && typeof paystackResponse.customer === 'object'
      ? (paystackResponse.customer as Record<string, unknown>)
      : null;
  const customerEmail =
    typeof customer?.email === 'string' ? customer.email : undefined;

  const insertRow = {
    amount: verifiedAmount.amount.toString(),
    currency: 'NGN',
    description: `Paystack wallet DVA top-up matched via customer account ${accountNumber}`,
    gateway: 'paystack',
    gateway_reference: gatewayReference,
    merchant_amount: 0,
    merchant_id: accountRow.merchant_id,
    metadata: {
      customer_email: customerEmail,
      customer_id: accountRow.customer_id,
      paid_at: paidAt,
      transaction_type: WALLET_TOP_UP_TRANSACTION_TYPE,
      wallet_account_id: accountRow.id,
      wallet_dva_account_number: accountNumber,
      wallet_dva_lookup_path: 'customer_wallet_payment_accounts',
    },
    order_id: null,
    platform_fee: 0,
    status: 'pending' as const,
    transaction_type: 'payment',
  };

  const { data: inserted, error: insertError } = await supabase
    .from('transactions')
    .insert(insertRow)
    .select(AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT)
    .single();

  if (
    insertError &&
    (insertError as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
  ) {
    const { data: reused, error: reusedError } = await supabase
      .from('transactions')
      .select(AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT)
      .eq('gateway_reference', gatewayReference)
      .maybeSingle();
    if (reusedError || !reused) {
      throw reusedError ?? new Error('Wallet DVA transaction collision was not readable');
    }
    return {
      kind: 'match',
      transaction: normalizeAgenticPaystackDvaTransaction(reused),
    };
  }

  if (insertError || !inserted) {
    throw insertError ?? new Error('Wallet DVA transaction was not inserted');
  }

  return {
    kind: 'match',
    transaction: normalizeAgenticPaystackDvaTransaction(inserted),
  };
}
```

- [ ] **Step 4: Run the focused helper test**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.ts apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.test.ts
git commit -m "feat: match wallet dva webhooks"
```

---

### Task 6: Wire Wallet DVA Matching Into Paystack Webhook

**Files:**
- Modify: `apps/web/src/app/api/payments/webhook/route.ts`
- Modify: `apps/web/src/app/api/payments/webhook/route.test.ts`

- [ ] **Step 1: Write the failing webhook tests**

Add a Paystack `charge.success` test where the gateway reference is Paystack's numeric reference and no existing `transactions.gateway_reference` row exists before DVA matching.

The mocked webhook body must include the receiver account number:

```ts
const paystackPayload = {
  event: 'charge.success',
  data: {
    amount: 2000000,
    authorization: {
      receiver_bank_account_number: '1234567890',
    },
    channel: 'dedicated_nuban',
    currency: 'NGN',
    paid_at: '2026-05-20T10:36:29.000Z',
    reference: '100026260509110323000058369193',
    status: 'success',
  },
};
```

Expect:

```ts
expect(mockConfirmPaystackWalletDvaTopUp).toHaveBeenCalledWith(
  expect.objectContaining({
    accountNumber: '1234567890',
    gatewayReference: '100026260509110323000058369193',
    verifiedAmount: { amount: 20000, currency: 'NGN' },
  })
);
expect(mockCreditWalletTopUp).toHaveBeenCalledWith(
  expect.objectContaining({
    amount: 20000,
    customerId: 'customer-1',
    gateway: 'paystack',
    merchantId: 'merchant-1',
    transactionId: 'txn-1',
  })
);
```

Add a replay test where `confirmPaystackWalletDvaTopUp` returns the same completed transaction and `creditWalletTopUp` is still called once, relying on ledger idempotency.

- [ ] **Step 2: Run the focused webhook tests and verify failure**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/app/api/payments/webhook/route.test.ts
```

Expected: FAIL because the wallet DVA helper is not wired.

- [ ] **Step 3: Wire the helper**

In `apps/web/src/app/api/payments/webhook/route.ts`, import:

```ts
import { confirmPaystackWalletDvaTopUp } from '@/lib/payments/confirm-paystack-wallet-dva-top-up';
```

Inside the existing `if (gateway === 'paystack')` DVA block, after `confirmAgenticPaystackDvaPayment` and before `confirmPaystackDvaByOrderAccount`, add:

```ts
if (!resolvedAgenticTransaction) {
  const walletDvaPayment = await confirmPaystackWalletDvaTopUp({
    accountNumber: receiverAccountNumber,
    gatewayReference: reference,
    paystackResponse: gatewayResponse,
    supabase,
    verifiedAmount,
  });

  if (walletDvaPayment.kind === 'match') {
    resolvedAgenticTransaction = walletDvaPayment.transaction;
  }
}
```

This placement is intentional:

- Agentic checkout DVA gets first chance because it already owns `checkout_sessions`.
- Wallet permanent DVA gets second chance because it is uniquely keyed by customer account number.
- Order DVA fallback remains third because order DVA may have multiple historical candidates for the same receiver account.

- [ ] **Step 4: Run the focused webhook tests**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/app/api/payments/webhook/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/payments/webhook/route.ts apps/web/src/app/api/payments/webhook/route.test.ts
git commit -m "feat: credit wallet topups from paystack dva webhooks"
```

---

### Task 7: Add Mobile Funding Account Client

**Files:**
- Create: `apps/mobile-storefront/lib/wallet-funding-account.ts`
- Create: `apps/mobile-storefront/lib/wallet-funding-account.test.ts`

- [ ] **Step 1: Write the failing client tests**

Create `apps/mobile-storefront/lib/wallet-funding-account.test.ts`:

```ts
import { getWalletFundingAccount } from './wallet-funding-account';
import { mockFetchWithTimeout } from './wallet-top-up.test-utils';

describe('getWalletFundingAccount', () => {
  it('fetches and validates the customer wallet funding account', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account: {
            accountName: 'OGABASSEY/ADA LOVELACE',
            accountNumber: '1234567890',
            bankName: 'Wema Bank',
            currency: 'NGN',
            provider: 'paystack',
          },
          success: true,
        }),
        { status: 200 }
      )
    );

    const result = await getWalletFundingAccount({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
    });

    expect(result.account.accountNumber).toBe('1234567890');
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'https://usebaci.com/api/storefront/customer/wallet/funding-account?merchantId=merchant-1&merchantSlug=ogabassey',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
```

- [ ] **Step 2: Run the focused client test and verify failure**

Run:

```bash
pnpm --filter baci-mobile-storefront test apps/mobile-storefront/lib/wallet-funding-account.test.ts
```

Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement the client**

Create `apps/mobile-storefront/lib/wallet-funding-account.ts`:

```ts
import { z } from 'zod';
import { EXPO_PUBLIC_API_URL } from '@/env';
import { CONFIG } from '@/lib/config';
import { DEFAULT_TIMEOUT, fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { supabase } from '@/lib/supabase';

const WalletFundingAccountResponseSchema = z.object({
  account: z.object({
    accountName: z.string().min(1),
    accountNumber: z.string().regex(/^\d{6,20}$/),
    bankName: z.string().min(1),
    currency: z.literal('NGN'),
    provider: z.literal('paystack'),
  }),
  success: z.literal(true),
});

export type WalletFundingAccountResponse = z.infer<
  typeof WalletFundingAccountResponseSchema
>;

function getOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getMerchantSlug(value?: string | null) {
  return getOptionalString(value) ?? getOptionalString(CONFIG.MERCHANT_SLUG);
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('Authentication required. Please sign in again.');
  }
  return session.access_token;
}

export async function getWalletFundingAccount({
  merchantId,
  merchantSlug,
}: {
  merchantId?: string | null;
  merchantSlug?: string | null;
}): Promise<WalletFundingAccountResponse> {
  const accessToken = await getAccessToken();
  const params = new URLSearchParams();
  const normalizedMerchantId = getOptionalString(merchantId);
  const normalizedMerchantSlug = getMerchantSlug(merchantSlug);
  if (normalizedMerchantId) params.set('merchantId', normalizedMerchantId);
  if (normalizedMerchantSlug) params.set('merchantSlug', normalizedMerchantSlug);

  const response = await fetchWithTimeout(
    `${EXPO_PUBLIC_API_URL}/api/storefront/customer/wallet/funding-account?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      timeout: DEFAULT_TIMEOUT,
    }
  );

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Unable to load wallet funding account.'
    );
  }

  return WalletFundingAccountResponseSchema.parse(data);
}
```

- [ ] **Step 4: Run the focused client test**

Run:

```bash
pnpm --filter baci-mobile-storefront test apps/mobile-storefront/lib/wallet-funding-account.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-storefront/lib/wallet-funding-account.ts apps/mobile-storefront/lib/wallet-funding-account.test.ts
git commit -m "feat: fetch wallet funding account in mobile storefront"
```

---

### Task 8: Update Mobile Wallet UI To Show Paystack DVA

**Files:**
- Modify: `apps/mobile-storefront/app/wallet/index.tsx`
- Modify: `apps/mobile-storefront/components/wallet/WalletContent.tsx`
- Modify: `apps/mobile-storefront/components/wallet/WalletContent.test.tsx`
- Modify: `apps/mobile-storefront/__tests__/app/wallet/index.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Update the wallet screen test that currently expects a route push to `/payment-gateway`.

Replace the old assertion:

```ts
expect(mockRouterPush).toHaveBeenCalledWith(
  expect.objectContaining({ pathname: '/payment-gateway' })
);
```

With:

```ts
expect(mockGetWalletFundingAccount).toHaveBeenCalledWith({
  merchantId: 'merchant-1',
  merchantSlug: 'ogabassey',
});
expect(mockRouterPush).not.toHaveBeenCalledWith(
  expect.objectContaining({ pathname: '/payment-gateway' })
);
expect(screen.getByText('1234567890')).toBeOnTheScreen();
expect(screen.getByText('Wema Bank')).toBeOnTheScreen();
expect(screen.getByText('OGABASSEY/ADA LOVELACE')).toBeOnTheScreen();
```

Add a `WalletContent` component test:

```ts
it('shows the Paystack wallet funding account inside the fund panel', () => {
  render(
    <WalletContent
      {...baseProps}
      fundingAccount={{
        accountName: 'OGABASSEY/ADA LOVELACE',
        accountNumber: '1234567890',
        bankName: 'Wema Bank',
        currency: 'NGN',
        provider: 'paystack',
      }}
      showFundPanel={true}
    />
  );

  expect(screen.getByText('Transfer to this account')).toBeOnTheScreen();
  expect(screen.getByText('1234567890')).toBeOnTheScreen();
  expect(screen.getByLabelText('Copy wallet funding account number')).toBeOnTheScreen();
});
```

- [ ] **Step 2: Run the focused mobile tests and verify failure**

Run:

```bash
pnpm --filter baci-mobile-storefront test apps/mobile-storefront/__tests__/app/wallet/index.test.tsx apps/mobile-storefront/components/wallet/WalletContent.test.tsx
```

Expected: FAIL because the UI still launches Checkout.

- [ ] **Step 3: Update `WalletContent` props and panel**

Add this prop shape to `WalletContentProps`:

```ts
fundingAccount?: {
  accountName: string;
  accountNumber: string;
  bankName: string;
  currency: 'NGN';
  provider: 'paystack';
} | null;
isFundingAccountLoading: boolean;
onCopyFundingAccount: () => void;
```

In the fund panel, replace the amount-only copy with:

```tsx
<Text style={[styles.redeemPanelTitle, { color: colors.text }]}>
  Fund Wallet
</Text>
<Text style={[styles.redeemPanelSubtitle, { color: colors.textSecondary }]}>
  Transfer from your banking app. Your wallet updates automatically after Paystack confirms the transfer.
</Text>

{isFundingAccountLoading ? (
  <ActivityIndicator size="small" color={BRAND.primary} />
) : fundingAccount ? (
  <View style={[styles.fundingAccountBox, { borderColor: colors.border }]}>
    <Text style={[styles.fundingAccountLabel, { color: colors.textSecondary }]}>
      Transfer to this account
    </Text>
    <Text style={[styles.fundingAccountNumber, { color: colors.text }]}>
      {fundingAccount.accountNumber}
    </Text>
    <Text style={[styles.fundingAccountMeta, { color: colors.textSecondary }]}>
      {fundingAccount.bankName}
    </Text>
    <Text style={[styles.fundingAccountMeta, { color: colors.textSecondary }]}>
      {fundingAccount.accountName}
    </Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Copy wallet funding account number"
      onPress={onCopyFundingAccount}
      style={[styles.confirmBtn, { backgroundColor: BRAND.primary }]}
    >
      <Text style={styles.confirmBtnText}>Copy Account Number</Text>
    </Pressable>
  </View>
) : (
  <Text style={[styles.redeemPanelSubtitle, { color: colors.textSecondary }]}>
    Unable to load your account. Pull down to refresh and try again.
  </Text>
)}
```

Add styles in `apps/mobile-storefront/components/wallet/wallet.styles.ts`:

```ts
fundingAccountBox: {
  borderRadius: 12,
  borderWidth: 1,
  gap: 8,
  padding: 16,
},
fundingAccountLabel: {
  fontSize: 12,
  fontWeight: '600',
  textTransform: 'uppercase',
},
fundingAccountNumber: {
  fontSize: 28,
  fontWeight: '800',
  letterSpacing: 0,
},
fundingAccountMeta: {
  fontSize: 14,
  fontWeight: '500',
},
```

- [ ] **Step 4: Update wallet screen behavior**

In `apps/mobile-storefront/app/wallet/index.tsx`:

- Import `getWalletFundingAccount`.
- Add `fundingAccount` and `isFundingAccountLoading` state.
- On `onOpenFundPanel`, call `getWalletFundingAccount({ merchantId: activeMerchantId, merchantSlug: activeMerchantSlug })`.
- Replace `handleFundWallet` Checkout launch with a refresh-oriented action:

```ts
const handleFundWallet = async () => {
  await refetch();
  Alert.alert(
    'Waiting for Transfer',
    'After you complete the bank transfer, your wallet balance updates automatically when Paystack confirms the payment.'
  );
};
```

- Track `wallet_funding_account_viewed` instead of `wallet_top_up_started` when the account is shown.
- Keep amount validation only if the UI keeps a required amount helper for insufficient-balance flows. If the amount input remains visible, make it informational and do not send it to Paystack.

- [ ] **Step 5: Run the focused mobile tests**

Run:

```bash
pnpm --filter baci-mobile-storefront test apps/mobile-storefront/__tests__/app/wallet/index.test.tsx apps/mobile-storefront/components/wallet/WalletContent.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile-storefront/app/wallet/index.tsx apps/mobile-storefront/components/wallet/WalletContent.tsx apps/mobile-storefront/components/wallet/WalletContent.test.tsx apps/mobile-storefront/components/wallet/wallet.styles.ts apps/mobile-storefront/__tests__/app/wallet/index.test.tsx
git commit -m "feat: show wallet bank funding account"
```

---

### Task 9: Update Web Ogabassey Wallet Page

**Files:**
- Modify: `apps/web/src/components/storefront/ogabassey/pages/wallet.tsx`
- Create or modify: `apps/web/src/components/storefront/ogabassey/pages/wallet.test.tsx`

- [ ] **Step 1: Write failing web wallet tests**

Add tests that authenticate the customer, mock the funding account endpoint, click `Fund Wallet`, and assert the bank account appears:

```ts
expect(await screen.findByText('1234567890')).toBeInTheDocument();
expect(screen.getByText('Wema Bank')).toBeInTheDocument();
expect(screen.getByText('OGABASSEY/ADA LOVELACE')).toBeInTheDocument();
expect(screen.queryByText('Wallet funding is currently being updated.')).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused web wallet test and verify failure**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/components/storefront/ogabassey/pages/wallet.test.tsx
```

Expected: FAIL because the page still shows an alert placeholder.

- [ ] **Step 3: Implement account fetch and display**

In `wallet.tsx`, replace `handleFundWallet` with:

```ts
const [fundingAccount, setFundingAccount] = useState<{
  accountName: string;
  accountNumber: string;
  bankName: string;
  currency: 'NGN';
  provider: 'paystack';
} | null>(null);
const [fundingAccountLoading, setFundingAccountLoading] = useState(false);

const handleFundWallet = async () => {
  if (!merchant?.slug) return;
  setFundingAccountLoading(true);
  try {
    const res = await fetch(
      `/api/storefront/customer/wallet/funding-account?merchantSlug=${encodeURIComponent(merchant.slug)}`
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Unable to load wallet funding account'
      );
    }
    setFundingAccount(data.account);
  } catch (error) {
    console.error('Failed to fetch wallet funding account', error);
  } finally {
    setFundingAccountLoading(false);
  }
};
```

Render the account below the balance card:

```tsx
{fundingAccount ? (
  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
    <p className="text-xs font-semibold uppercase text-gray-500">
      Transfer to this account
    </p>
    <p className="mt-2 text-2xl font-bold text-gray-900">
      {fundingAccount.accountNumber}
    </p>
    <p className="text-sm text-gray-600">{fundingAccount.bankName}</p>
    <p className="text-sm text-gray-600">{fundingAccount.accountName}</p>
  </div>
) : null}
```

- [ ] **Step 4: Run the focused web wallet test**

Run:

```bash
pnpm --filter @baci/web test apps/web/src/components/storefront/ogabassey/pages/wallet.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/storefront/ogabassey/pages/wallet.tsx apps/web/src/components/storefront/ogabassey/pages/wallet.test.tsx
git commit -m "feat: show ogabassey wallet funding account"
```

---

### Task 10: Verify End-To-End And Production Safety

**Files:**
- No new files. This task validates the full stack.

- [ ] **Step 1: Run focused backend tests**

```bash
pnpm --filter @baci/web test \
  apps/web/src/lib/agentic/paystack.test.ts \
  apps/web/src/lib/customer-wallet-payment-account.test.ts \
  apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts \
  apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.test.ts \
  apps/web/src/app/api/payments/webhook/route.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused mobile tests**

```bash
pnpm --filter baci-mobile-storefront test \
  apps/mobile-storefront/lib/wallet-funding-account.test.ts \
  apps/mobile-storefront/__tests__/app/wallet/index.test.tsx \
  apps/mobile-storefront/components/wallet/WalletContent.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run repository gates**

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected: all PASS.

- [ ] **Step 4: Run CodeRabbit prompt-only review**

```bash
coderabbit review --prompt-only -t uncommitted
```

Expected: no critical or high findings. Fix any critical/high finding before opening the PR.

- [ ] **Step 5: Manual staging verification with Paystack test mode**

Use Paystack test mode and the Paystack DVA test bank flow:

1. Log in as an Ogabassey test customer.
2. Open Wallet.
3. Tap Add Funds.
4. Confirm the UI displays a Paystack funding account.
5. Send a test transfer to the account from Paystack's demo bank app.
6. Confirm Paystack sends `charge.success`.
7. Confirm `transactions` has one completed `paystack` row for the Paystack reference.
8. Confirm `customer_wallet_transactions` has one `wallet_topup` credit whose `source_id` is the transaction id.
9. Replay the same webhook payload and confirm no duplicate wallet credit is created.

Expected SQL checks:

```sql
SELECT gateway, gateway_reference, amount, status, metadata->>'transaction_type'
FROM public.transactions
WHERE gateway = 'paystack'
ORDER BY created_at DESC
LIMIT 5;

SELECT type, amount, source_type, source_id, balance_after
FROM public.customer_wallet_transactions
WHERE source_type = 'wallet_topup'
ORDER BY created_at DESC
LIMIT 5;
```

- [ ] **Step 6: Commit final fixes**

```bash
git add .
git commit -m "test: verify paystack wallet dva flow"
```

Only create this final commit if Task 10 required actual test or review fixes. If no files changed after Task 9, skip this commit.

---

## Rollout Notes

- Keep the existing `/api/storefront/customer/wallet/top-up/initialize` and `/confirm` routes during rollout as a fallback path. Do not delete them in this PR.
- The mobile wallet UI should prefer the DVA funding account. If the funding-account API fails, show a retryable error instead of silently routing to regular Checkout, because silent fallback would reintroduce higher fees.
- Ask Paystack support to confirm the production DVA account limit before wide release. Paystack public docs mention a default limit of 1,000 dedicated accounts, which may need review for all Ogabassey customers.
- After deployment, monitor Paystack webhook 404s and wallet top-up support tickets for 48 hours.

## Self Review

- Spec coverage: the plan covers Paystack DVA creation, storage, authenticated access, webhook matching, wallet ledger crediting, mobile UI, web UI, and verification.
- Placeholder scan: the plan has no deferred implementation markers. Every task has concrete files, expected tests, and command gates.
- Type consistency: the plan uses `provider: 'paystack'`, `transaction_type: 'wallet_topup'`, `customer_wallet_payment_accounts`, and `WalletFundingAccount` consistently across backend and mobile code.
