import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reloadMerchantMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const useMerchantMock = vi.hoisted(() => vi.fn());
const virtualTerminalProps = vi.hoisted(
  () => [] as { businessName?: string; merchantId: string }[]
);

vi.mock('@/components/merchant-bank-form', () => ({
  MerchantBankForm: () => null,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: useMerchantMock,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: toastMock })),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn(),
}));

vi.mock('./components/virtual-terminal-settings', () => ({
  VirtualTerminalSettings: (props: {
    businessName?: string;
    merchantId: string;
  }) => {
    virtualTerminalProps.push(props);
    return <div data-testid="virtual-terminal-settings" />;
  },
}));

import { fetchWithCsrf } from '@/lib/api-client';
import PaymentSettingsPage from './page';

const merchantA = {
  id: '11111111-1111-4111-8111-111111111111',
  business_name: 'Merchant A',
  country: 'IN',
  bank_account_number: null,
  paystack_subaccount_code: null,
};
const merchantB = {
  ...merchantA,
  id: '22222222-2222-4222-8222-222222222222',
  business_name: 'Merchant B',
};
const merchantASettings = {
  paystack_enabled: false,
  korapay_enabled: false,
  pay_on_delivery_enabled: false,
  preferred_local_gateway: 'korapay',
  preferred_international_gateway: 'korapay',
  credit_direct_enabled: false,
};
const merchantBSettings = {
  ...merchantASettings,
  pay_on_delivery_enabled: true,
};

describe('PaymentSettingsPage merchant switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    virtualTerminalProps.length = 0;
    window.history.replaceState({}, '', '/dashboard/settings/payments');
    useMerchantMock.mockReturnValue({
      merchant: merchantA,
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });
    vi.mocked(fetchWithCsrf).mockResolvedValue({ ok: true } as Response);
  });

  it('loads and saves settings for the displayed merchant', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => merchantASettings,
    }) as typeof fetch;

    render(<PaymentSettingsPage />);

    await screen.findByRole('heading', { name: /payment settings/i });
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/merchant/features?merchantId=${merchantA.id}`
    );
    expect(virtualTerminalProps.at(-1)).toEqual(
      expect.objectContaining({ merchantId: merchantA.id })
    );

    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(fetchWithCsrf).toHaveBeenCalled();
    });
    const body = JSON.parse(
      String(vi.mocked(fetchWithCsrf).mock.calls.at(-1)?.[1]?.body)
    );
    expect(body).toEqual(expect.objectContaining({ merchantId: merchantA.id }));
  });

  it('does not save merchant A settings while merchant B is loading', async () => {
    const user = userEvent.setup();
    let resolveMerchantB: ((response: Response) => void) | undefined;
    const merchantBResponse = new Promise<Response>((resolve) => {
      resolveMerchantB = resolve;
    });
    global.fetch = vi.fn((input: string) => {
      if (input.includes(merchantB.id)) return merchantBResponse;
      return Promise.resolve({
        ok: true,
        json: async () => merchantASettings,
      } as Response);
    }) as typeof fetch;

    const { rerender } = render(<PaymentSettingsPage />);
    await screen.findByRole('heading', { name: /payment settings/i });

    useMerchantMock.mockReturnValue({
      merchant: merchantB,
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });
    rerender(<PaymentSettingsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/merchant/features?merchantId=${merchantB.id}`
      );
    });
    expect(
      screen.queryByRole('button', { name: /save settings/i })
    ).not.toBeInTheDocument();
    expect(fetchWithCsrf).not.toHaveBeenCalled();

    resolveMerchantB?.({
      ok: true,
      json: async () => merchantBSettings,
    } as Response);

    const saveButton = await screen.findByRole('button', {
      name: /save settings/i,
    });
    await user.click(saveButton);

    await waitFor(() => {
      expect(fetchWithCsrf).toHaveBeenCalled();
    });
    const body = JSON.parse(
      String(vi.mocked(fetchWithCsrf).mock.calls.at(-1)?.[1]?.body)
    );
    expect(body).toEqual(
      expect.objectContaining({
        merchantId: merchantB.id,
        pay_on_delivery_enabled: true,
      })
    );
  });

  it.each([
    true,
    false,
  ])('ignores a stale merchant A save %s after merchant B is ready', async (saveSucceeds) => {
    const user = userEvent.setup();
    if (saveSucceeds) {
      window.history.replaceState(
        {},
        '',
        '/dashboard/settings/payments?onboarding=true'
      );
    }
    let settleMerchantASave: ((response: Response) => void) | undefined;
    vi.mocked(fetchWithCsrf).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          settleMerchantASave = resolve;
        })
    );
    global.fetch = vi.fn((input: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          input.includes(merchantB.id) ? merchantBSettings : merchantASettings,
      } as Response)
    ) as typeof fetch;

    const { rerender } = render(<PaymentSettingsPage />);
    await screen.findByRole('heading', { name: /payment settings/i });
    await user.click(screen.getByRole('button', { name: /save settings/i }));
    expect(
      screen.getByRole('button', { name: /save settings/i })
    ).toBeDisabled();

    useMerchantMock.mockReturnValue({
      merchant: merchantB,
      loading: false,
      reloadMerchant: reloadMerchantMock,
    });
    rerender(<PaymentSettingsPage />);

    const merchantBSave = await screen.findByRole('button', {
      name: /save settings/i,
    });
    expect(merchantBSave).toBeEnabled();
    expect(virtualTerminalProps.at(-1)).toEqual(
      expect.objectContaining({ merchantId: merchantB.id })
    );

    settleMerchantASave?.({ ok: saveSucceeds } as Response);

    await waitFor(() => {
      expect(merchantBSave).toBeEnabled();
    });
    expect(toastMock).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/dashboard/settings/payments');
  });
});
