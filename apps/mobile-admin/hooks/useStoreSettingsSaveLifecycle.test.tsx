import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreSettingsFormValues } from '@/components/store-settings/store-settings-payload';
import type { StatusModalState } from '@/components/ui/StatusModal';

const mocks = vi.hoisted(() => ({
  invalidateAfterSave: vi.fn().mockResolvedValue(undefined),
  updateMerchant: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/merchant-settings', () => ({
  updateMerchantIdentitySettings: mocks.updateMerchant,
}));

vi.mock('@/lib/store-settings-save-readiness', () => ({
  invalidateStoreSettingsAfterSave: mocks.invalidateAfterSave,
}));

import { useStoreSettingsSaveLifecycle } from './useStoreSettingsSaveLifecycle';

const baseline: StoreSettingsFormValues = {
  business_address: '',
  business_name: 'Baci Store',
  country: 'NG',
  payout_currency: 'NGN',
  phone: '',
  slug: 'baci-store',
  support_email: '',
  support_phone: '',
};

const formValues: StoreSettingsFormValues = {
  ...baseline,
  business_name: 'Saved server name',
};

describe('useStoreSettingsSaveLifecycle', () => {
  beforeEach(() => {
    mocks.invalidateAfterSave.mockClear();
    mocks.invalidateAfterSave.mockResolvedValue(undefined);
    mocks.updateMerchant.mockClear();
    mocks.updateMerchant.mockResolvedValue(undefined);
  });

  it('does not clear a later edit when the earlier save succeeds', async () => {
    let completeSave!: () => void;
    let revision = 0;
    const resetFormDirty = vi.fn();
    mocks.updateMerchant.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeSave = resolve;
        })
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      () => {
        const [statusModal, setStatusModal] = useState<StatusModalState>({
          visible: false,
          type: 'success',
          title: '',
          message: '',
        });
        const lifecycle = useStoreSettingsSaveLifecycle({
          baseline,
          formValues,
          from: undefined,
          getFormRevision: () => revision,
          merchant: { id: 'merchant-1', updated_at: '2026-07-30T12:00:00Z' },
          onRefreshedLocalSave: vi.fn(),
          queryClient,
          resetFormDirty,
          router: { back: vi.fn() },
          setStatusModal,
          syncedMerchantUpdatedAt: '2026-07-30T12:00:00Z',
        });
        return { ...lifecycle, statusModal };
      },
      { wrapper }
    );

    act(result.current.startSave);
    await waitFor(() => expect(mocks.updateMerchant).toHaveBeenCalledTimes(1));

    revision = 1;
    rerender();
    act(completeSave);

    await waitFor(() =>
      expect(mocks.invalidateAfterSave).toHaveBeenCalledWith(
        queryClient,
        'merchant-1'
      )
    );
    expect(resetFormDirty).not.toHaveBeenCalled();
    expect(result.current.statusModal.visible).toBe(false);
  });

  it('adopts the immutable RPC receipt when the merchant ref changes during invalidation', async () => {
    let releaseInvalidation!: () => void;
    mocks.invalidateAfterSave.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseInvalidation = resolve;
      })
    );
    mocks.updateMerchant.mockResolvedValueOnce({
      merchantId: 'merchant-1',
      savedValues: {
        ...baseline,
        business_name: 'Saved server name',
        support_email: 'owner@example.com',
      },
      updatedAt: '2026-07-30T20:00:00.000Z',
    });
    const onRefreshedLocalSave = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    let merchant = {
      id: 'merchant-1',
      updated_at: '2026-07-30T12:00:00Z',
    };
    const { result, rerender } = renderHook(
      () => {
        const [, setStatusModal] = useState<StatusModalState>({
          visible: false,
          type: 'success',
          title: '',
          message: '',
        });
        return useStoreSettingsSaveLifecycle({
          baseline,
          formValues,
          from: undefined,
          getFormRevision: () => 0,
          merchant,
          onRefreshedLocalSave,
          queryClient,
          resetFormDirty: vi.fn(),
          router: { back: vi.fn() },
          setStatusModal,
          syncedMerchantUpdatedAt: '2026-07-30T12:00:00Z',
        });
      },
      { wrapper }
    );

    act(result.current.startSave);
    await waitFor(() => expect(mocks.invalidateAfterSave).toHaveBeenCalled());

    merchant = {
      id: 'merchant-1',
      updated_at: '2026-07-30T20:01:00.000Z',
    };
    rerender();
    await act(async () => releaseInvalidation());

    expect(onRefreshedLocalSave).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      savedValues: {
        ...baseline,
        business_name: 'Saved server name',
        support_email: 'owner@example.com',
      },
      updatedAt: '2026-07-30T20:00:00.000Z',
    });
  });

  it('does not apply a merchant A receipt after switching to merchant B during invalidation', async () => {
    let releaseInvalidation!: () => void;
    mocks.invalidateAfterSave.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseInvalidation = resolve;
      })
    );
    mocks.updateMerchant.mockResolvedValueOnce({
      merchantId: 'merchant-1',
      savedValues: formValues,
      updatedAt: '2026-07-30T20:00:00.000Z',
    });
    const onRefreshedLocalSave = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    let merchant = {
      id: 'merchant-1',
      updated_at: '2026-07-30T12:00:00Z',
    };
    const { result, rerender } = renderHook(
      () => {
        const [, setStatusModal] = useState<StatusModalState>({
          visible: false,
          type: 'success',
          title: '',
          message: '',
        });
        return useStoreSettingsSaveLifecycle({
          baseline,
          formValues,
          from: undefined,
          getFormRevision: () => 0,
          merchant,
          onRefreshedLocalSave,
          queryClient,
          resetFormDirty: vi.fn(),
          router: { back: vi.fn() },
          setStatusModal,
          syncedMerchantUpdatedAt: '2026-07-30T12:00:00Z',
        });
      },
      { wrapper }
    );

    act(result.current.startSave);
    await waitFor(() => expect(mocks.invalidateAfterSave).toHaveBeenCalled());

    merchant = {
      id: 'merchant-2',
      updated_at: '2026-07-30T20:01:00.000Z',
    };
    rerender();
    await act(async () => releaseInvalidation());

    expect(onRefreshedLocalSave).not.toHaveBeenCalled();
  });

  it('keeps a persisted save successful when cache invalidation rejects', async () => {
    const receipt = {
      merchantId: 'merchant-1',
      savedValues: formValues,
      updatedAt: '2026-07-30T20:00:00.000Z',
    };
    const onRefreshedLocalSave = vi.fn();
    const resetFormDirty = vi.fn();
    mocks.updateMerchant.mockResolvedValueOnce(receipt);
    mocks.invalidateAfterSave.mockRejectedValueOnce(
      new Error('cache refresh failed')
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn());
    const { result } = renderHook(
      () => {
        const [statusModal, setStatusModal] = useState<StatusModalState>({
          visible: false,
          type: 'success',
          title: '',
          message: '',
        });
        const lifecycle = useStoreSettingsSaveLifecycle({
          baseline,
          formValues,
          getFormRevision: () => 0,
          merchant: { id: 'merchant-1', updated_at: '2026-07-30T12:00:00Z' },
          onRefreshedLocalSave,
          queryClient,
          resetFormDirty,
          router: { back: vi.fn() },
          setStatusModal,
          syncedMerchantUpdatedAt: '2026-07-30T12:00:00Z',
        });
        return { ...lifecycle, statusModal };
      },
      { wrapper }
    );

    act(result.current.startSave);
    await waitFor(() =>
      expect(onRefreshedLocalSave).toHaveBeenCalledWith(receipt)
    );
    expect(resetFormDirty).toHaveBeenCalledOnce();
    expect(result.current.statusModal).toMatchObject({
      visible: true,
      type: 'success',
    });
    expect(consoleError).not.toHaveBeenCalledWith(
      'Update error:',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });
});
