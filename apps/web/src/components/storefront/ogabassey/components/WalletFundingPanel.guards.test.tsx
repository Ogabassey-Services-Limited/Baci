import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletFundingPanel } from './WalletFundingPanel';

const mockCaptureClientEvent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/posthog/capture-client-event', () => ({
  captureClientEvent: mockCaptureClientEvent,
}));

describe('WalletFundingPanel CTA guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [
      'phone persistence is unavailable',
      { customerPhone: '', merchantSlug: 'ogabassey' },
    ],
    [
      'merchant context is unresolved',
      { customerPhone: undefined, merchantSlug: undefined },
    ],
  ])('disables account creation when %s', (_reason, overrides) => {
    render(
      <WalletFundingPanel
        account={null}
        merchantSlug={overrides.merchantSlug}
        customerPhone={overrides.customerPhone}
        onAccountCreated={vi.fn()}
        requiresConsent={true}
        surface="utility_modal"
      />
    );

    expect(
      screen.getByRole('button', { name: /get my account number/i })
    ).toBeDisabled();
  });
});
