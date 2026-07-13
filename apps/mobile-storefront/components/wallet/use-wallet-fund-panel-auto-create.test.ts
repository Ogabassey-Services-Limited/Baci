import { jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useWalletFundPanelAutoCreate } from '@/components/wallet/use-wallet-fund-panel-auto-create';

function renderAutoCreate(
  overrides: Partial<Parameters<typeof useWalletFundPanelAutoCreate>[0]> = {}
) {
  const onCreateFundingAccount = jest.fn<() => unknown>(async () => true);
  const initialProps = {
    canCreateFundingAccount: true,
    fundAmount: '',
    hasFundingAccount: false,
    isCreatingFundingAccount: false,
    onCreateFundingAccount,
    ...overrides,
  };
  const utils = renderHook(
    (props: typeof initialProps) => useWalletFundPanelAutoCreate(props),
    { initialProps }
  );
  return { ...utils, initialProps, onCreateFundingAccount };
}

describe('useWalletFundPanelAutoCreate', () => {
  it('auto-creates once for an empty-amount open (bank-transfer intent)', async () => {
    const { onCreateFundingAccount, rerender, initialProps } =
      renderAutoCreate();

    await waitFor(() => {
      expect(onCreateFundingAccount).toHaveBeenCalledTimes(1);
    });

    rerender({ ...initialProps });
    expect(onCreateFundingAccount).toHaveBeenCalledTimes(1);
  });

  it('never auto-creates for a prefilled open, even after the amount is cleared', async () => {
    const { onCreateFundingAccount, rerender, result, initialProps } =
      renderAutoCreate({ fundAmount: '1000' });

    expect(result.current.openedWithPrefill).toBe(true);
    expect(onCreateFundingAccount).not.toHaveBeenCalled();

    // Customer clears the prefilled input — the card intent must stick.
    rerender({ ...initialProps, fundAmount: '' });

    expect(onCreateFundingAccount).not.toHaveBeenCalled();
    expect(result.current.openedWithPrefill).toBe(true);
  });

  it('latches the card intent when a prefill arrives after an empty mount', () => {
    // Mounted empty but ineligible (no auto-create yet); a route action then
    // prefills the amount, and DVA prerequisites become available.
    const { rerender, result, onCreateFundingAccount, initialProps } =
      renderAutoCreate({ canCreateFundingAccount: false });

    expect(onCreateFundingAccount).not.toHaveBeenCalled();
    expect(result.current.openedWithPrefill).toBe(false);

    rerender({ ...initialProps, fundAmount: '1000' });
    expect(result.current.openedWithPrefill).toBe(true);

    // Now eligible AND the customer clears the amount — must stay a card
    // intent, never auto-create.
    rerender({
      ...initialProps,
      canCreateFundingAccount: true,
      fundAmount: '',
    });

    expect(onCreateFundingAccount).not.toHaveBeenCalled();
    expect(result.current.openedWithPrefill).toBe(true);
  });

  it('auto-creates once when availability flips false→true on an empty-amount open', async () => {
    // The needsPhone flow mounts the panel empty and ineligible; once the phone
    // saves, availability flips and the DVA must auto-create exactly once.
    const { onCreateFundingAccount, rerender, initialProps } = renderAutoCreate(
      {
        canCreateFundingAccount: false,
      }
    );

    expect(onCreateFundingAccount).not.toHaveBeenCalled();

    rerender({ ...initialProps, canCreateFundingAccount: true });

    await waitFor(() => {
      expect(onCreateFundingAccount).toHaveBeenCalledTimes(1);
    });

    // The attempt latch keeps it from firing again on a further re-render.
    rerender({ ...initialProps, canCreateFundingAccount: true });
    expect(onCreateFundingAccount).toHaveBeenCalledTimes(1);
  });

  it('skips creation when an account already exists or creation is unavailable', () => {
    const existing = renderAutoCreate({ hasFundingAccount: true });
    expect(existing.onCreateFundingAccount).not.toHaveBeenCalled();

    const unavailable = renderAutoCreate({ canCreateFundingAccount: false });
    expect(unavailable.onCreateFundingAccount).not.toHaveBeenCalled();
  });

  it('flags failure when creation resolves false', async () => {
    const { result } = renderAutoCreate({
      onCreateFundingAccount: jest.fn<() => unknown>(async () => false),
    });

    await waitFor(() => {
      expect(result.current.autoCreateFailed).toBe(true);
    });
  });

  it('flags failure when creation rejects', async () => {
    const { result } = renderAutoCreate({
      onCreateFundingAccount: jest.fn<() => unknown>(async () => {
        throw new Error('network down');
      }),
    });

    await waitFor(() => {
      expect(result.current.autoCreateFailed).toBe(true);
    });
  });
});
