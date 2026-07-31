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
import { useTaxMutations } from '@/hooks/useTaxMutations';

const { mockAlert, mockUpdateMerchantSettings } = vi.hoisted(() => ({
  mockAlert: vi.fn(),
  mockUpdateMerchantSettings: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: { alert: mockAlert },
}));

vi.mock('@/lib/merchant-settings', () => ({
  updateMerchantSettings: (...args: unknown[]) =>
    mockUpdateMerchantSettings(...args),
}));

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

describe('useTaxMutations concurrent merchant rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps merchant A completion UI when a merchant B render is abandoned', async () => {
    let resolveWrite!: () => void;
    const write = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    const suspendedMerchantRender = new Promise<never>(() => undefined);
    mockUpdateMerchantSettings.mockReturnValueOnce(write);
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    function TaxControls({
      merchantId,
      suspend,
    }: {
      merchantId: string;
      suspend: boolean;
    }) {
      const [, setVatEnabled] = useState(false);
      const { updateVatMutation } = useTaxMutations({
        city: 'Lagos',
        merchantId,
        postalCode: '100001',
        setVatEnabled,
        stateCode: 'NG-LA',
        street: '12 Allen Avenue',
      });
      if (suspend) throw suspendedMerchantRender;
      return (
        <button
          onClick={() => void updateVatMutation.mutateAsync(true)}
          type="button"
        >
          Save VAT for {merchantId}
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
            <TaxControls
              merchantId={merchantId}
              suspend={merchantId === 'merchant-b'}
            />
          </Suspense>
        </>
      );
    }

    render(<Scenario />, { wrapper: Wrapper });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save VAT for merchant-a' })
    );
    await waitFor(() =>
      expect(mockUpdateMerchantSettings).toHaveBeenCalledWith('merchant-a', {
        vat_registration_status: 'registered',
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch merchant' }));
    expect(
      screen.getByRole('button', { name: 'Save VAT for merchant-a' })
    ).toBeTruthy();

    await act(async () => {
      resolveWrite();
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['merchant'] });
    expect(mockAlert).toHaveBeenCalledWith(
      'Success',
      'VAT has been enabled. 7.5% VAT will be applied to all orders.'
    );
  });
});
