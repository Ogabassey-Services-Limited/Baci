import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrustSettingsForm } from './trust-settings-form';

const mockUpdateMerchant = vi.fn();
const merchantId = 'merchant-2';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({ updateMerchant: mockUpdateMerchant }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe('TrustSettingsForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sanitizes the draft and saves it to the selected merchant', async () => {
    mockUpdateMerchant.mockResolvedValue(undefined);
    render(
      <TrustSettingsForm
        merchantId={merchantId}
        initialTrustProfile={
          {
            customer_service: { legacy_channel: 'sms' },
          } as never
        }
      />
    );
    fireEvent.change(screen.getByLabelText(/shipping regions/i), {
      target: { value: 'NG, GH' },
    });
    fireEvent.change(screen.getByLabelText(/handling days minimum/i), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText(/handling days maximum/i), {
      target: { value: '4' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /save trust settings/i })
    );

    await waitFor(() => {
      expect(mockUpdateMerchant).toHaveBeenCalledWith(
        {
          trust_profile: expect.objectContaining({
            shipping_policy: expect.objectContaining({
              regions: ['NG', 'GH'],
              handling_days_min: 2,
              handling_days_max: 4,
            }),
          }),
        },
        { merchantId, skipReload: true }
      );
    });
    const payload = mockUpdateMerchant.mock.calls[0]?.[0]
      ?.trust_profile as Record<string, unknown>;
    const customerService = payload.customer_service as Record<string, unknown>;
    expect(payload).not.toHaveProperty('legacy_top_level');
    expect(customerService).not.toHaveProperty('legacy_channel');
  });
});
