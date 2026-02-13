import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test', currency: 'NGN' },
    loading: false,
  })),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

import { MerchantBankForm } from './merchant-bank-form';

describe('MerchantBankForm', () => {
  it('exports a valid component', () => {
    expect(MerchantBankForm).toBeDefined();
    expect(typeof MerchantBankForm).toBe('function');
  });
});
