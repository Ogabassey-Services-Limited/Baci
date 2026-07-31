import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { type ReactNode, Suspense, startTransition, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreSettingsFormValues } from '@/components/store-settings/store-settings-payload';
import type { StatusModalState } from '@/components/ui/StatusModal';
import { useStoreSettingsSaveLifecycle } from './useStoreSettingsSaveLifecycle';

const mocks = vi.hoisted(() => ({
  invalidateAfterSave: vi.fn().mockResolvedValue(undefined),
  updateMerchant: vi.fn(),
}));

vi.mock('@/lib/merchant-settings', () => ({
  updateMerchantIdentitySettings: (...args: unknown[]) =>
    mocks.updateMerchant(...args),
}));

vi.mock('@/lib/store-settings-save-readiness', () => ({
  invalidateStoreSettingsAfterSave: (...args: unknown[]) =>
    mocks.invalidateAfterSave(...args),
}));

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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('useStoreSettingsSaveLifecycle concurrent merchant rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invalidateAfterSave.mockResolvedValue(undefined);
  });

  it('keeps merchant A save active when a merchant B render is abandoned', async () => {
    let resolveSave!: () => void;
    const save = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const suspendedMerchantRender = new Promise<never>(() => undefined);
    mocks.updateMerchant.mockImplementationOnce(async () => {
      await save;
      return {
        merchantId: 'merchant-a',
        savedValues: { ...baseline, business_name: 'Saved server name' },
        updatedAt: '2026-07-31T10:01:00.000Z',
      };
    });
    const onRefreshedLocalSave = vi.fn();
    const { queryClient, Wrapper } = createWrapper();

    function SaveControls({
      merchantId,
      suspend,
    }: {
      merchantId: string;
      suspend: boolean;
    }) {
      const [, setStatusModal] = useState<StatusModalState>({
        visible: false,
        type: 'success',
        title: '',
        message: '',
      });
      const { startSave } = useStoreSettingsSaveLifecycle({
        baseline,
        formValues: { ...baseline, business_name: 'Saved server name' },
        getFormRevision: () => 0,
        merchant: { id: merchantId, updated_at: '2026-07-31T10:00:00.000Z' },
        onRefreshedLocalSave,
        queryClient,
        resetFormDirty: vi.fn(),
        router: { back: vi.fn() },
        setStatusModal,
        syncedMerchantUpdatedAt: '2026-07-31T10:00:00.000Z',
      });
      if (suspend) throw suspendedMerchantRender;
      return (
        <button onClick={startSave} type="button">
          Save {merchantId}
        </button>
      );
    }

    function Scenario() {
      const [merchantId, setMerchantId] = useState('merchant-a');
      return (
        <>
          <button
            onClick={() => {
              startTransition(() => setMerchantId('merchant-b'));
            }}
            type="button"
          >
            Switch merchant
          </button>
          <Suspense fallback={<span>Loading merchant B</span>}>
            <SaveControls
              merchantId={merchantId}
              suspend={merchantId === 'merchant-b'}
            />
          </Suspense>
        </>
      );
    }

    render(<Scenario />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'Save merchant-a' }));
    await waitFor(() => expect(mocks.updateMerchant).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Switch merchant' }));
    expect(
      screen.getByRole('button', { name: 'Save merchant-a' })
    ).toBeTruthy();

    await act(async () => {
      resolveSave();
    });

    expect(onRefreshedLocalSave).toHaveBeenCalledWith({
      merchantId: 'merchant-a',
      savedValues: { ...baseline, business_name: 'Saved server name' },
      updatedAt: '2026-07-31T10:01:00.000Z',
    });
  });
});
