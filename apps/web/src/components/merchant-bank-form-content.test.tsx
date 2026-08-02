import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { MerchantBankFormContent } from './merchant-bank-form-content';

describe('MerchantBankFormContent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('composes the manual payout experience without fetching Paystack banks', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <MerchantBankFormContent
        merchantId="22222222-2222-4222-8222-222222222222"
        countryCode="IN"
        initialData={{ businessName: 'Yodha Shopping' }}
      />
    );

    expect(
      screen.getByText(/manual invoice bank details/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Bank Name')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
