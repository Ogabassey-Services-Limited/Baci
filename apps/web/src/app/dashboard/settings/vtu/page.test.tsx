import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useMerchantMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: useMerchantMock,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn(),
}));

import { fetchWithCsrf } from '@/lib/api-client';
import VTUSettingsPage from './page';

const merchantA = { id: 'merchant-a' };
const merchantB = { id: 'merchant-b' };
const merchantASettings = {
  vtu_enabled: true,
  vtu_airtime_enabled: true,
  vtu_data_enabled: true,
  vtu_checkout_addon_enabled: false,
  vtu_checkout_addon_amounts: [100],
  vtu_loyalty_reward_enabled: false,
  vtu_merchant_commission_rate: 0.5,
};

describe('VTUSettingsPage merchant switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMerchantMock.mockReturnValue({ merchant: merchantA });
  });

  it('withholds VTU controls until a merchant ID is resolved', () => {
    useMerchantMock.mockReturnValue({ merchant: null, loading: false });

    render(<VTUSettingsPage />);

    expect(
      screen.getByText(/merchant context is unavailable/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /save settings/i })
    ).not.toBeInTheDocument();
  });

  it('does not expose merchant A settings while merchant B is loading', async () => {
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

    const { rerender } = render(<VTUSettingsPage />);
    await screen.findByText('VTU Services Active');

    useMerchantMock.mockReturnValue({ merchant: merchantB });
    rerender(<VTUSettingsPage />);

    expect(
      screen.queryByRole('button', { name: /save settings/i })
    ).not.toBeInTheDocument();

    resolveMerchantB?.({
      ok: true,
      json: async () => ({ ...merchantASettings, vtu_enabled: false }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText('VTU Services Disabled')).toBeInTheDocument();
    });
  });

  it('keeps merchant B saving when merchant A save settles after a switch', async () => {
    const user = userEvent.setup();
    let settleMerchantASave: ((response: Response) => void) | undefined;
    let settleMerchantBSave: ((response: Response) => void) | undefined;
    vi.mocked(fetchWithCsrf)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            settleMerchantASave = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            settleMerchantBSave = resolve;
          })
      );
    global.fetch = vi.fn((input: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          input.includes(merchantB.id)
            ? { ...merchantASettings, vtu_enabled: false }
            : merchantASettings,
      } as Response)
    ) as typeof fetch;

    const { rerender } = render(<VTUSettingsPage />);
    const merchantASave = await screen.findByRole('button', {
      name: /save settings/i,
    });
    await user.click(merchantASave);

    useMerchantMock.mockReturnValue({ merchant: merchantB });
    rerender(<VTUSettingsPage />);

    const merchantBSave = await screen.findByRole('button', {
      name: /save settings/i,
    });
    await user.click(merchantBSave);
    expect(merchantBSave).toBeDisabled();

    settleMerchantASave?.({ ok: true } as Response);

    await waitFor(() => {
      expect(merchantBSave).toBeDisabled();
    });
    expect(toastMock).not.toHaveBeenCalled();

    settleMerchantBSave?.({ ok: true } as Response);
    await waitFor(() => {
      expect(merchantBSave).toBeEnabled();
    });
  });
});
