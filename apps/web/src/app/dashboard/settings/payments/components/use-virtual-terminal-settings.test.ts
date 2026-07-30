import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVirtualTerminalSettings } from './use-virtual-terminal-settings';
import {
  createVirtualTerminalAccount,
  fetchVirtualTerminalData,
} from './virtual-terminal-requests';

vi.mock('./virtual-terminal-requests', () => ({
  createVirtualTerminalAccount: vi.fn(),
  createVirtualTerminalBranch: vi.fn(),
  fetchVirtualTerminalData: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: toastMock })),
}));

const merchantA = '11111111-1111-4111-8111-111111111111';
const merchantB = '22222222-2222-4222-8222-222222222222';
const toastMock = vi.hoisted(() => vi.fn());

describe('useVirtualTerminalSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps merchant B data when merchant A resolves after a switch', async () => {
    type TerminalData = Awaited<ReturnType<typeof fetchVirtualTerminalData>>;
    let resolveA: ((value: TerminalData) => void) | undefined;
    vi.mocked(fetchVirtualTerminalData)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveA = resolve;
          })
      )
      .mockResolvedValueOnce({
        accounts: [{ id: 'terminal-b' } as never],
        branches: [],
      });

    const { result, rerender } = renderHook(
      ({ merchantId }) =>
        useVirtualTerminalSettings({ businessName: 'Store', merchantId }),
      { initialProps: { merchantId: merchantA } }
    );

    rerender({ merchantId: merchantB });
    await waitFor(() => {
      expect(result.current.accounts).toEqual([{ id: 'terminal-b' }]);
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      resolveA?.({ accounts: [{ id: 'terminal-a' } as never], branches: [] });
    });

    expect(result.current.accounts).toEqual([{ id: 'terminal-b' }]);
  });

  it('suppresses a late merchant A create completion after switching to B', async () => {
    let resolveCreate: (() => void) | undefined;
    vi.mocked(fetchVirtualTerminalData).mockResolvedValue({
      accounts: [],
      branches: [],
    } as never);
    vi.mocked(createVirtualTerminalAccount).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        })
    );
    const { result, rerender } = renderHook(
      ({ merchantId }) =>
        useVirtualTerminalSettings({ businessName: 'Store', merchantId }),
      { initialProps: { merchantId: merchantA } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() =>
      result.current.setNewAccount((value) => ({ ...value, name: 'Till' }))
    );
    let createPromise: Promise<void> | undefined;
    act(() => {
      createPromise = result.current.handleCreateAccount();
    });

    rerender({ merchantId: merchantB });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      resolveCreate?.();
      await createPromise;
    });

    expect(result.current.creating).toBe(false);
    expect(toastMock).not.toHaveBeenCalled();
  });
});
