import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eligibility: vi.fn(),
  merchantContext: vi.fn(),
  place: vi.fn(),
}));
vi.mock('./imei-remediation-api', () => ({
  imeiRemediationApi: {
    eligibility: mocks.eligibility,
    place: mocks.place,
  },
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: mocks.merchantContext,
}));

import { ImeiRemediationOffer } from './imei-remediation-offer';

const offer = {
  carrier: 'AT&T',
  id: '33333333-3333-4333-8333-333333333333',
  name: 'AT&T Clean Unlock',
  priceNgn: 100_000,
  priceUsdt: 65,
  refundPolicy: 'refundable' as const,
  successRate: 82,
  turnaround: '1-7 Days',
};

describe('ImeiRemediationOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.merchantContext.mockReturnValue({
      basePath: '/ogabassey',
      merchant: { slug: 'ogabassey' },
    });
    mocks.eligibility.mockResolvedValue({
      assessmentId: '22222222-2222-4222-8222-222222222222',
      kind: 'eligible',
      offers: [offer],
      usdtEnabled: true,
    });
    mocks.place.mockResolvedValue({
      kind: 'pending',
      orderId: '22222222-2222-4222-8222-222222222222',
      status: 'submitted',
    });
  });

  it('renders no client-inferred CTA until the server approves an offer', async () => {
    let resolveEligibility: (value: unknown) => void = () => undefined;
    mocks.eligibility.mockReturnValue(
      new Promise((resolve) => {
        resolveEligibility = resolve;
      })
    );
    render(
      <ImeiRemediationOffer
        identifier="490154203237518"
        lookupId="11111111-1111-4111-8111-111111111111"
      />
    );

    expect(
      screen.queryByRole('button', { name: /unlock this device/i })
    ).toBeNull();
    resolveEligibility({
      assessmentId: '22222222-2222-4222-8222-222222222222',
      kind: 'eligible',
      offers: [offer],
      usdtEnabled: true,
    });

    expect(
      await screen.findByRole('button', { name: /unlock this device/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/sim-locked to at&t/i)).toBeInTheDocument();
    expect(screen.getByText(/usually 1-7 days/i)).toBeInTheDocument();
    expect(mocks.eligibility).toHaveBeenCalledWith(
      expect.objectContaining({ merchantSlug: 'ogabassey' })
    );
  });

  it('confirms USDT wallet payment and links to order tracking', async () => {
    const user = userEvent.setup();
    render(
      <ImeiRemediationOffer
        identifier="490154203237518"
        lookupId="11111111-1111-4111-8111-111111111111"
      />
    );

    await user.click(
      await screen.findByRole('button', { name: /unlock this device/i })
    );
    await user.click(screen.getByRole('radio', { name: /65.00 usdt/i }));
    await user.click(screen.getByRole('button', { name: /confirm and pay/i }));

    await waitFor(() =>
      expect(mocks.place).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantSlug: 'ogabassey',
          paymentCurrency: 'USDT',
        })
      )
    );
    expect(
      await screen.findByRole('link', { name: /view unlock orders/i })
    ).toHaveAttribute('href', '/ogabassey/unlock-orders');
  });

  it('keeps order tracking root-relative on domain storefronts', async () => {
    const user = userEvent.setup();
    mocks.merchantContext.mockReturnValue({
      merchant: { slug: 'ogabassey' },
    });
    render(
      <ImeiRemediationOffer
        identifier="490154203237518"
        lookupId="11111111-1111-4111-8111-111111111111"
      />
    );

    await user.click(
      await screen.findByRole('button', { name: /unlock this device/i })
    );
    await user.click(screen.getByRole('button', { name: /confirm and pay/i }));

    expect(
      await screen.findByRole('link', { name: /view unlock orders/i })
    ).toHaveAttribute('href', '/unlock-orders');
  });

  it('supports native arrow-key navigation between payment currencies', async () => {
    const user = userEvent.setup();
    render(
      <ImeiRemediationOffer
        identifier="490154203237518"
        lookupId="11111111-1111-4111-8111-111111111111"
      />
    );

    await user.click(
      await screen.findByRole('button', { name: /unlock this device/i })
    );
    const ngn = screen.getByRole('radio', { name: /₦100,000/i });
    const usdt = screen.getByRole('radio', { name: /65.00 usdt/i });

    await user.tab();
    expect(ngn).toHaveFocus();
    await user.keyboard('{ArrowRight}');

    expect(usdt).toHaveFocus();
    expect(usdt).toBeChecked();
  });

  it('links to the matching wallet funding rail after a 402', async () => {
    const user = userEvent.setup();
    mocks.place.mockResolvedValue({
      code: 'WALLET_INSUFFICIENT',
      error: 'Insufficient wallet balance',
      kind: 'error',
      status: 402,
    });
    render(
      <ImeiRemediationOffer
        identifier="490154203237518"
        lookupId="11111111-1111-4111-8111-111111111111"
      />
    );

    await user.click(
      await screen.findByRole('button', { name: /unlock this device/i })
    );
    await user.click(screen.getByRole('button', { name: /confirm and pay/i }));

    expect(
      await screen.findByRole('link', { name: /fund ngn wallet/i })
    ).toHaveAttribute('href', '/ogabassey/wallet?fund=1');
    expect(
      screen.getByRole('link', { name: /fund usdt wallet/i })
    ).toHaveAttribute(
      'href',
      '/ogabassey/wallet?fund-usdt=1&amount=65'
    );
  });

  it('keeps wallet funding links root-relative on domain storefronts', async () => {
    const user = userEvent.setup();
    mocks.merchantContext.mockReturnValue({
      merchant: { slug: 'ogabassey' },
    });
    mocks.place.mockResolvedValue({
      code: 'WALLET_INSUFFICIENT',
      error: 'Insufficient wallet balance',
      kind: 'error',
      status: 402,
    });
    render(
      <ImeiRemediationOffer
        identifier="490154203237518"
        lookupId="11111111-1111-4111-8111-111111111111"
      />
    );

    await user.click(
      await screen.findByRole('button', { name: /unlock this device/i })
    );
    await user.click(screen.getByRole('button', { name: /confirm and pay/i }));

    expect(
      await screen.findByRole('link', { name: /fund ngn wallet/i })
    ).toHaveAttribute('href', '/wallet?fund=1');
    expect(
      screen.getByRole('link', { name: /fund usdt wallet/i })
    ).toHaveAttribute('href', '/wallet?fund-usdt=1&amount=65');
  });
});
