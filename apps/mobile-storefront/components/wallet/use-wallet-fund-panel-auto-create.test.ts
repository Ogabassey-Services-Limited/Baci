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
