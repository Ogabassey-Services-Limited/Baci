import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useV2Wallet, V2WalletProvider } from './v2-wallet-context';

function WalletProbe() {
  const { earningsBalance, deductEarnings, addEarnings } = useV2Wallet();

  return (
    <div>
      <output aria-label="balance">{earningsBalance}</output>
      <button type="button" onClick={() => addEarnings(1000)}>
        add
      </button>
      <button type="button" onClick={() => deductEarnings(2000)}>
        deduct
      </button>
      <button type="button" onClick={() => deductEarnings(10_000_000)}>
        deduct too much
      </button>
    </div>
  );
}

function renderWallet() {
  return render(
    <V2WalletProvider>
      <WalletProbe />
    </V2WalletProvider>
  );
}

describe('V2WalletProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts with the default balance when nothing is saved', () => {
    renderWallet();

    expect(screen.getByRole('status', { name: 'balance' })).toHaveTextContent(
      '50000'
    );
  });

  it('reads a previously saved balance from localStorage', () => {
    window.localStorage.setItem('ogabassey_v2_wallet', '12345');

    renderWallet();

    expect(screen.getByRole('status', { name: 'balance' })).toHaveTextContent(
      '12345'
    );
  });

  it('adds earnings and persists the new balance', () => {
    renderWallet();

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    expect(screen.getByRole('status', { name: 'balance' })).toHaveTextContent(
      '51000'
    );
    expect(window.localStorage.getItem('ogabassey_v2_wallet')).toBe('51000');
  });

  it('deducts earnings when the balance is sufficient', () => {
    renderWallet();

    fireEvent.click(screen.getByRole('button', { name: 'deduct' }));

    expect(screen.getByRole('status', { name: 'balance' })).toHaveTextContent(
      '48000'
    );
    expect(window.localStorage.getItem('ogabassey_v2_wallet')).toBe('48000');
  });

  it('leaves the balance unchanged when a deduction exceeds it', () => {
    renderWallet();

    fireEvent.click(screen.getByRole('button', { name: 'deduct too much' }));

    expect(screen.getByRole('status', { name: 'balance' })).toHaveTextContent(
      '50000'
    );
    expect(window.localStorage.getItem('ogabassey_v2_wallet')).toBeNull();
  });

  it('throws when useV2Wallet is used outside the provider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      expect(() => render(<WalletProbe />)).toThrow(
        'useV2Wallet must be used within a V2WalletProvider'
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
