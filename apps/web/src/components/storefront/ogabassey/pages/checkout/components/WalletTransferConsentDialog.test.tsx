import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WalletTransferConsentDialog } from './WalletTransferConsentDialog';

describe('WalletTransferConsentDialog', () => {
  it('names the merchant that will create the account', () => {
    render(
      <WalletTransferConsentDialog
        merchantName="Test Store"
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />
    );

    expect(screen.getByText(/Test Store will create/i)).toBeDefined();
  });

  it('accepts consent', () => {
    const onAccept = vi.fn();
    render(
      <WalletTransferConsentDialog
        merchantName="Test Store"
        onAccept={onAccept}
        onDecline={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /create my account/i }));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('declines consent so the checkout can fall back to a one-off account', () => {
    const onDecline = vi.fn();
    render(
      <WalletTransferConsentDialog
        merchantName="Test Store"
        onAccept={vi.fn()}
        onDecline={onDecline}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /not now/i }));

    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
