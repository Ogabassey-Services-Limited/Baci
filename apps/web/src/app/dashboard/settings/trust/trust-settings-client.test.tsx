import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrustSettingsClient } from './trust-settings-client';

const mockUpdateMerchant = vi.fn();
const mockToast = vi.fn();

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
  useMerchant: () => ({
    updateMerchant: mockUpdateMerchant,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('TrustSettingsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the existing trust profile values into the form', () => {
    render(
      <TrustSettingsClient
        initialTrustProfile={{
          founded_year: 2018,
          customer_service: {
            whatsapp_number: '+2348111111111',
            hours_summary: 'Mon-Sat, 8am-6pm',
            timezone: 'Africa/Lagos',
            response_time_summary: 'Within 2 business hours',
          },
          return_policy: {
            summary: 'Returns accepted for defective items.',
            window_days: 7,
            return_method: 'mail',
            return_fees: 'free',
          },
          shipping_policy: {
            summary: 'Nationwide delivery available.',
            regions: ['NG'],
            handling_days_min: 0,
            handling_days_max: 1,
            transit_days_min: 1,
            transit_days_max: 5,
            shipping_fee_type: 'calculated',
          },
        }}
      />
    );

    expect(screen.getByLabelText(/founded year/i)).toHaveValue(2018);
    expect(screen.getByLabelText(/whatsapp support number/i)).toHaveValue(
      '+2348111111111'
    );
    expect(screen.getByLabelText(/support hours summary/i)).toHaveValue(
      'Mon-Sat, 8am-6pm'
    );
    expect(screen.getByLabelText(/support timezone/i)).toHaveValue(
      'Africa/Lagos'
    );
    expect(screen.getByLabelText(/support response time summary/i)).toHaveValue(
      'Within 2 business hours'
    );
    expect(screen.getByLabelText(/return policy summary/i)).toHaveValue(
      'Returns accepted for defective items.'
    );
    expect(screen.getByLabelText(/return window days/i)).toHaveValue(7);
    expect(screen.getByLabelText(/return method/i)).toHaveValue('mail');
    expect(screen.getByLabelText(/return fees/i)).toHaveValue('free');
    expect(screen.getByLabelText(/shipping summary/i)).toHaveValue(
      'Nationwide delivery available.'
    );
    expect(screen.getByLabelText(/handling days minimum/i)).toHaveValue(0);
    expect(screen.getByLabelText(/handling days maximum/i)).toHaveValue(1);
    expect(screen.getByLabelText(/transit days minimum/i)).toHaveValue(1);
    expect(screen.getByLabelText(/transit days maximum/i)).toHaveValue(5);
    expect(screen.getByLabelText(/shipping fee type/i)).toHaveValue(
      'calculated'
    );
  });

  it('submits sanitized trust_profile data through updateMerchant', async () => {
    mockUpdateMerchant.mockResolvedValue(undefined);

    render(
      <TrustSettingsClient
        initialTrustProfile={
          {
            founded_year: 2018,
            customer_service: {
              whatsapp_number: '+2348111111111',
              hours_summary: 'Mon-Sat, 8am-6pm',
              timezone: 'Africa/Lagos',
              response_time_summary: 'Within 2 business hours',
              legacy_channel: 'sms',
            },
            return_policy: {
              summary: 'Returns accepted for defective items.',
              window_days: 7,
              return_method: 'mail',
              return_fees: 'free',
            },
            shipping_policy: {
              summary: 'Nationwide delivery available.',
              regions: ['NG'],
              handling_days_min: 0,
              handling_days_max: 1,
              transit_days_min: 1,
              transit_days_max: 5,
              shipping_fee_type: 'calculated',
            },
            warranty_policy: {
              summary: 'Manufacturer warranty applies.',
            },
            legacy_top_level: 'keep-out',
          } as unknown as Parameters<
            typeof TrustSettingsClient
          >[0]['initialTrustProfile']
        }
      />
    );

    fireEvent.change(screen.getByLabelText(/founded year/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/support timezone/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/support response time summary/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/return policy summary/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/return window days/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/return method/i), {
      target: { value: 'carrier_dropoff' },
    });
    fireEvent.change(screen.getByLabelText(/return fees/i), {
      target: { value: 'customer_pays' },
    });
    fireEvent.change(screen.getByLabelText(/shipping summary/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/shipping regions/i), {
      target: { value: 'NG, GH' },
    });
    fireEvent.change(screen.getByLabelText(/handling days minimum/i), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText(/handling days maximum/i), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByLabelText(/transit days minimum/i), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText(/transit days maximum/i), {
      target: { value: '6' },
    });
    fireEvent.change(screen.getByLabelText(/shipping fee type/i), {
      target: { value: 'flat_rate' },
    });
    fireEvent.change(screen.getByLabelText(/warranty summary/i), {
      target: { value: '' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /save trust settings/i })
    );

    await waitFor(() => {
      expect(mockUpdateMerchant).toHaveBeenCalledWith({
        trust_profile: expect.objectContaining({
          founded_year: null,
          customer_service: expect.objectContaining({
            timezone: null,
            response_time_summary: null,
          }),
          return_policy: {
            summary: null,
            window_days: null,
            return_method: 'carrier_dropoff',
            return_fees: 'customer_pays',
          },
          shipping_policy: expect.objectContaining({
            summary: null,
            regions: ['NG', 'GH'],
            handling_days_min: 2,
            handling_days_max: 4,
            transit_days_min: 3,
            transit_days_max: 6,
            shipping_fee_type: 'flat_rate',
          }),
          warranty_policy: {
            summary: null,
          },
        }),
      });
    });

    const payload = mockUpdateMerchant.mock.calls[0]?.[0]
      ?.trust_profile as Record<string, unknown>;
    const customerService = payload.customer_service as Record<string, unknown>;
    expect(payload).not.toHaveProperty('legacy_top_level');
    expect(customerService).not.toHaveProperty('legacy_channel');
  });

  it('renders deep links back to the existing settings surfaces', () => {
    render(<TrustSettingsClient initialTrustProfile={null} />);

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

  it('blocks malformed numeric values and shows inline guidance', async () => {
    render(<TrustSettingsClient initialTrustProfile={null} />);

    fireEvent.change(screen.getByLabelText(/return window days/i), {
      target: { value: '2.5' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /save trust settings/i })
    );

    await waitFor(() => {
      expect(mockUpdateMerchant).not.toHaveBeenCalled();
      expect(screen.getByText(/review the fields below/i)).toBeInTheDocument();
      expect(screen.getByText(/enter a whole number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/return window days/i)).toHaveAttribute(
        'aria-invalid',
        'true'
      );
      expect(screen.getByLabelText(/return window days/i)).toHaveAttribute(
        'aria-describedby'
      );
    });
  });

  it('blocks inverted shipping and transit ranges', async () => {
    render(<TrustSettingsClient initialTrustProfile={null} />);

    fireEvent.change(screen.getByLabelText(/handling days minimum/i), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText(/handling days maximum/i), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText(/transit days minimum/i), {
      target: { value: '8' },
    });
    fireEvent.change(screen.getByLabelText(/transit days maximum/i), {
      target: { value: '3' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /save trust settings/i })
    );

    await waitFor(() => {
      expect(mockUpdateMerchant).not.toHaveBeenCalled();
      expect(
        screen.getAllByText(/maximum must be greater than or equal to minimum/i)
      ).toHaveLength(2);
      expect(screen.getByLabelText(/handling days maximum/i)).toHaveAttribute(
        'aria-invalid',
        'true'
      );
      expect(screen.getByLabelText(/transit days maximum/i)).toHaveAttribute(
        'aria-invalid',
        'true'
      );
    });
  });
});
