import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  mocks,
  paymentSettings,
  resetPaymentMethodsScreenMocks,
} from '@/test/payment-methods-screen';
import PaymentMethodsScreen from './payment-methods';

type QueryConfig = {
  queryFn: () => Promise<unknown>;
};

describe('PaymentMethodsScreen', () => {
  beforeEach(resetPaymentMethodsScreenMocks);

  it('renders Klump as a BNPL payment toggle', () => {
    render(<PaymentMethodsScreen />);

    expect(screen.getByText('Klump')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle Klump')).toBeChecked();
  });

  it('toggles the klump_enabled setting from rendered payment settings', () => {
    render(<PaymentMethodsScreen />);

    fireEvent.click(screen.getByLabelText('Toggle Klump'));
    expect(mocks.mutate).toHaveBeenCalledWith({
      field: 'klump_enabled',
      merchantId: 'merchant-1',
      settingsId: 'settings-1',
      value: false,
    });
  });

  it('hides payment methods whose backing settings columns are unavailable', () => {
    const { klump_enabled: _klumpEnabled, ...settingsWithoutKlump } =
      paymentSettings;
    mocks.useQuery.mockReturnValue({
      data: settingsWithoutKlump,
      error: null,
      isError: false,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<PaymentMethodsScreen />);

    expect(screen.queryByText('Klump')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Toggle Klump')).not.toBeInTheDocument();
    expect(screen.getByText('Credit Direct')).toBeInTheDocument();
  });

  it('shows the payment settings error state when settings fail to load', () => {
    mocks.useQuery.mockReturnValue({
      data: undefined,
      error: new Error('Failed to fetch'),
      isError: true,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<PaymentMethodsScreen />);

    expect(
      screen.getByText('Failed to load payment methods')
    ).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Retry loading payment methods')
    ).toBeInTheDocument();
  });

  it('shows the payment settings error state when the merchant fails to load', () => {
    mocks.useMerchantResult = {
      isLoading: false,
      merchant: null,
      error: new Error('Merchant not found'),
    };

    render(<PaymentMethodsScreen />);

    expect(
      screen.getByText('Failed to load payment methods')
    ).toBeInTheDocument();
    expect(screen.getByText('Merchant not found')).toBeInTheDocument();
  });

  it('alerts and rolls back when a payment method toggle fails', () => {
    render(<PaymentMethodsScreen />);

    mocks.mutationConfig?.onError?.(
      new Error('Failed to update payment method'),
      { field: 'klump_enabled', value: false },
      { merchantId: 'merchant-1', previousSettings: paymentSettings }
    );

    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to update payment method'
    );
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ['payment-settings', 'merchant-1'],
      paymentSettings
    );
  });

  it('restores and refreshes the origin cache when a toggle fails after switching merchants', async () => {
    let activeMerchantId = 'merchant-1';
    mocks.useMerchantResult = {
      isLoading: false,
      merchant: {
        get id() {
          return activeMerchantId;
        },
      },
      error: null,
    };

    render(<PaymentMethodsScreen />);
    const originMutation = mocks.mutationConfig;
    const context = await originMutation?.onMutate?.({
      field: 'klump_enabled',
      merchantId: 'merchant-1',
      settingsId: 'settings-1',
      value: false,
    });

    activeMerchantId = 'merchant-2';
    const error = new Error('Failed to update payment method');
    const variables = { field: 'klump_enabled', value: false };
    originMutation?.onError?.(error, variables, context);
    await originMutation?.onSettled?.(undefined, error, variables, context);

    expect(mocks.setQueryData).toHaveBeenLastCalledWith(
      ['payment-settings', 'merchant-1'],
      paymentSettings
    );
    expect(mocks.invalidateQueries).toHaveBeenLastCalledWith({
      queryKey: ['payment-settings', 'merchant-1'],
    });
  });

  it('refreshes the originating merchant readiness after a successful toggle', async () => {
    render(<PaymentMethodsScreen />);

    const context = await mocks.mutationConfig?.onMutate?.({
      field: 'klump_enabled',
      merchantId: 'merchant-1',
      settingsId: 'settings-1',
      value: false,
    });

    mocks.useMerchantResult = {
      isLoading: false,
      merchant: { id: 'merchant-2' },
      error: null,
    };

    await mocks.mutationConfig?.onSuccess?.(
      undefined,
      { field: 'klump_enabled', value: false },
      context
    );

    expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
      expect.any(Object),
      'merchant-1'
    );
  });

  it('does not reject a committed toggle when readiness refresh fails', async () => {
    render(<PaymentMethodsScreen />);
    const context = await mocks.mutationConfig?.onMutate?.({
      field: 'klump_enabled',
      merchantId: 'merchant-1',
      settingsId: 'settings-1',
      value: false,
    });
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );

    await expect(
      mocks.mutationConfig?.onSuccess?.(
        undefined,
        { field: 'klump_enabled', value: false },
        context
      )
    ).resolves.toBeUndefined();
  });

  it('retries payment settings fetch when PostgREST reports missing columns', async () => {
    let capturedQueryFn: (() => Promise<unknown>) | undefined;

    mocks.useQuery.mockImplementation((config: QueryConfig) => {
      capturedQueryFn = config.queryFn;
      return {
        data: paymentSettings,
        error: null,
        isError: false,
        isLoading: false,
        refetch: mocks.refetch,
      };
    });

    mocks.single
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "Could not find the 'klump_enabled' column of 'merchant_feature_settings' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "Could not find the 'juicyway_enabled' column of 'merchant_feature_settings' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          paystack_enabled: true,
          korapay_enabled: true,
          credpal_enabled: false,
          credit_direct_enabled: false,
          pay_on_delivery_enabled: true,
        },
        error: null,
      });

    render(<PaymentMethodsScreen />);

    expect(capturedQueryFn).toBeDefined();
    if (!capturedQueryFn) {
      throw new Error('Expected payment settings query function');
    }
    const result = await capturedQueryFn();

    expect(result).toEqual(
      expect.objectContaining({
        id: 'settings-1',
        merchant_id: 'merchant-1',
        paystack_enabled: true,
      })
    );
    expect(result).not.toHaveProperty('klump_enabled');
    expect(result).not.toHaveProperty('juicyway_enabled');

    const selectedColumns = mocks.select.mock.calls.map(
      ([columns]) => columns as string
    );
    expect(selectedColumns[0]).toContain('klump_enabled');
    expect(selectedColumns[0]).toContain('juicyway_enabled');
    expect(selectedColumns[1]).not.toContain('klump_enabled');
    expect(selectedColumns[1]).toContain('juicyway_enabled');
    expect(selectedColumns[2]).not.toContain('klump_enabled');
    expect(selectedColumns[2]).not.toContain('juicyway_enabled');
  });
});
