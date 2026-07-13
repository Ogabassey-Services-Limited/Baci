import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShippingRate, ShippingZone } from './shipping-types';

const mockRefresh = vi.fn();
const mockDeleteZone = vi.fn();
const mockDeleteRate = vi.fn();
const mockToggleRateActive = vi.fn();
const mockToast = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('./actions', () => ({
  deleteZone: (...args: unknown[]) => mockDeleteZone(...args),
}));

vi.mock('./rate-actions', () => ({
  deleteRate: (...args: unknown[]) => mockDeleteRate(...args),
  toggleRateActive: (...args: unknown[]) => mockToggleRateActive(...args),
}));

// The zone/rate dialogs pull in the full form machinery (location picker,
// popovers, etc.) — this smoke suite only needs to prove they're wired with
// the right props, so they're replaced with lightweight stand-ins.
vi.mock('./zone-form-dialog', () => ({
  ZoneFormDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="zone-form-dialog" /> : null,
}));

vi.mock('./rate-form-dialog', () => ({
  RateFormDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="rate-form-dialog" /> : null,
}));

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: () => false,
});

const { ShippingClient } = await import('./shipping-client');

const restOfWorldZone: ShippingZone = {
  id: 'z-row',
  name: 'Everywhere else',
  isRestOfWorld: true,
  active: true,
  locations: [],
};

const lagosZone: ShippingZone = {
  id: 'z-lagos',
  name: 'Lagos',
  isRestOfWorld: false,
  active: true,
  locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
};

const lagosRate: ShippingRate = {
  id: 'r-1',
  zoneId: 'z-lagos',
  name: 'Standard',
  kind: 'ship',
  currency: 'NGN',
  baseAmount: 1500,
  conditionType: 'always',
  minSubtotal: null,
  maxSubtotal: null,
  freeOverAmount: null,
  deliveryMinDays: 2,
  deliveryMaxDays: 4,
  pickupAddress: null,
  sortOrder: 0,
  active: true,
};

describe('ShippingClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders zones with the rest-of-world zone pinned last', () => {
    render(
      <ShippingClient
        initialZones={[restOfWorldZone, lagosZone]}
        initialRates={[lagosRate]}
        currencyCode="NGN"
        currencySymbol="₦"
      />
    );

    const zoneNames = [
      screen.getByText('Lagos'),
      screen.getByText('Everywhere else'),
    ];
    // DOM order proves the fallback zone is pinned last, regardless of the
    // input array order.
    expect(
      zoneNames[0].compareDocumentPosition(zoneNames[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('hides the delete button for the rest-of-world zone', () => {
    render(
      <ShippingClient
        initialZones={[restOfWorldZone]}
        initialRates={[]}
        currencyCode="NGN"
        currencySymbol="₦"
      />
    );

    expect(
      screen.queryByRole('button', { name: /delete everywhere else/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /delete disabled: this is the fallback zone/i,
      })
    ).toBeDisabled();
  });

  it('shows a delete button for a non-fallback zone', () => {
    render(
      <ShippingClient
        initialZones={[restOfWorldZone, lagosZone]}
        initialRates={[lagosRate]}
        currencyCode="NGN"
        currencySymbol="₦"
      />
    );

    expect(
      screen.getByRole('button', { name: /delete lagos/i })
    ).toBeInTheDocument();
  });

  it('shows the empty-state CTA on the fallback zone when no rates exist', () => {
    render(
      <ShippingClient
        initialZones={[restOfWorldZone]}
        initialRates={[]}
        currencyCode="NGN"
        currencySymbol="₦"
      />
    );

    expect(
      screen.getByText(
        /set your delivery fees so customers can check out anywhere/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add your first rate/i })
    ).toBeInTheDocument();
  });

  it('does not show the empty state once a rate exists', () => {
    render(
      <ShippingClient
        initialZones={[restOfWorldZone, lagosZone]}
        initialRates={[lagosRate]}
        currencyCode="NGN"
        currencySymbol="₦"
      />
    );

    expect(
      screen.queryByRole('button', { name: /add your first rate/i })
    ).not.toBeInTheDocument();
  });

  it('opens the zone create dialog when "Add Zone" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ShippingClient
        initialZones={[restOfWorldZone]}
        initialRates={[]}
        currencyCode="NGN"
        currencySymbol="₦"
      />
    );

    await user.click(screen.getByRole('button', { name: /add zone/i }));

    expect(screen.getByTestId('zone-form-dialog')).toBeInTheDocument();
  });

  it('deletes a non-fallback zone after confirmation', async () => {
    mockDeleteZone.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <ShippingClient
        initialZones={[restOfWorldZone, lagosZone]}
        initialRates={[lagosRate]}
        currencyCode="NGN"
        currencySymbol="₦"
      />
    );

    await user.click(screen.getByRole('button', { name: /delete lagos/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockDeleteZone).toHaveBeenCalledWith('z-lagos');
  });

  it('fires a destructive error toast when zone deletion rejects', async () => {
    mockDeleteZone.mockRejectedValue(new Error('Zone still in use'));
    const user = userEvent.setup();
    render(
      <ShippingClient
        initialZones={[restOfWorldZone, lagosZone]}
        initialRates={[lagosRate]}
        currencyCode="NGN"
        currencySymbol="₦"
      />
    );

    await user.click(screen.getByRole('button', { name: /delete lagos/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockDeleteZone).toHaveBeenCalledWith('z-lagos');
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'Zone still in use',
        })
      );
    });
  });
});
