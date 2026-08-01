import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrustSettingsClient } from './trust-settings-client';

const mockUpdateMerchant = vi.fn();

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

describe('TrustSettingsClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the existing trust profile values into the form', () => {
    render(
      <TrustSettingsClient
        merchantId="merchant-1"
        initialTrustProfile={{
          founded_year: 2018,
          customer_service: { whatsapp_number: '+2348111111111' },
          return_policy: { window_days: 7, return_method: 'mail' },
          shipping_policy: { handling_days_min: 0, transit_days_max: 5 },
        }}
      />
    );

    expect(screen.getByLabelText(/founded year/i)).toHaveValue(2018);
    expect(screen.getByLabelText(/whatsapp support number/i)).toHaveValue(
      '+2348111111111'
    );
    expect(screen.getByLabelText(/return window days/i)).toHaveValue(7);
    expect(screen.getByLabelText(/return method/i)).toHaveValue('mail');
    expect(screen.getByLabelText(/handling days minimum/i)).toHaveValue(0);
    expect(screen.getByLabelText(/transit days maximum/i)).toHaveValue(5);
  });

  it('renders deep links back to existing settings surfaces', () => {
    render(
      <TrustSettingsClient merchantId="merchant-1" initialTrustProfile={null} />
    );
    expect(
      screen.getByRole('link', { name: /contact basics/i })
    ).toHaveAttribute('href', '/dashboard/settings');
    expect(
      screen.getByRole('link', { name: /content pages/i })
    ).toHaveAttribute('href', '/dashboard/pages');
    expect(
      screen.getByRole('link', { name: /legal identity/i })
    ).toHaveAttribute('href', '/dashboard/settings/tax');
  });

  it('blocks malformed numeric values and inverted ranges', async () => {
    render(
      <TrustSettingsClient merchantId="merchant-1" initialTrustProfile={null} />
    );
    fireEvent.change(screen.getByLabelText(/return window days/i), {
      target: { value: '2.5' },
    });
    fireEvent.change(screen.getByLabelText(/handling days minimum/i), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText(/handling days maximum/i), {
      target: { value: '2' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /save trust settings/i })
    );

    await waitFor(() => {
      expect(mockUpdateMerchant).not.toHaveBeenCalled();
      expect(screen.getByText(/review the fields below/i)).toBeInTheDocument();
      expect(screen.getByText(/enter a whole number/i)).toBeInTheDocument();
    });
  });
});
