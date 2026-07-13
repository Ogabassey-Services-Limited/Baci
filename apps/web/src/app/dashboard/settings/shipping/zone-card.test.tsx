import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ShippingRate, ShippingZone } from './shipping-types';
import { ZoneCard } from './zone-card';

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: () => false,
});

const lagosZone: ShippingZone = {
  id: 'z-lagos',
  name: 'Lagos',
  isRestOfWorld: false,
  active: true,
  locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
};

const restOfWorldZone: ShippingZone = {
  id: 'z-row',
  name: 'Everywhere else',
  isRestOfWorld: true,
  active: true,
  locations: [],
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
  deliveryMinDays: null,
  deliveryMaxDays: null,
  pickupAddress: null,
  sortOrder: 0,
  active: true,
};

function renderCard(overrides: Partial<Parameters<typeof ZoneCard>[0]> = {}) {
  const props = {
    zone: lagosZone,
    rates: [] as ShippingRate[],
    onEditZone: vi.fn(),
    onDeleteZoneRequested: vi.fn(),
    onAddRate: vi.fn(),
    onEditRate: vi.fn(),
    onDeleteRateRequested: vi.fn(),
    onToggleRateActive: vi.fn(),
    togglingRateId: null,
    ...overrides,
  };
  render(<ZoneCard {...props} />);
  return props;
}

describe('ZoneCard', () => {
  it('renders the zone name and its location badges', () => {
    renderCard();

    expect(screen.getByText('Lagos')).toBeInTheDocument();
    expect(screen.getByText('Lagos, Nigeria')).toBeInTheDocument();
  });

  it('shows "No locations yet" for a zone with no locations', () => {
    renderCard({ zone: { ...lagosZone, locations: [] } });

    expect(screen.getByText('No locations yet')).toBeInTheDocument();
  });

  it('renders the fallback badge and matches-any-destination copy for the rest-of-world zone', () => {
    renderCard({ zone: restOfWorldZone });

    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(
      screen.getByText(/matches any destination not covered/i)
    ).toBeInTheDocument();
  });

  it('disables deletion for the rest-of-world zone', () => {
    renderCard({ zone: restOfWorldZone });

    expect(
      screen.getByRole('button', {
        name: /delete disabled: this is the fallback zone/i,
      })
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /^delete everywhere else$/i })
    ).not.toBeInTheDocument();
  });

  it('shows "No delivery options yet." when the zone has no rates', () => {
    renderCard({ rates: [] });

    expect(screen.getByText('No delivery options yet.')).toBeInTheDocument();
  });

  it('renders a RateRow for each rate', () => {
    renderCard({ rates: [lagosRate] });

    expect(screen.getByText('Standard')).toBeInTheDocument();
  });

  it('calls onEditZone and onDeleteZoneRequested for a non-fallback zone', async () => {
    const user = userEvent.setup();
    const props = renderCard();

    await user.click(screen.getByRole('button', { name: /edit lagos/i }));
    expect(props.onEditZone).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: /delete lagos/i }));
    expect(props.onDeleteZoneRequested).toHaveBeenCalledOnce();
  });

  it('calls onAddRate when "Add rate" is clicked', async () => {
    const user = userEvent.setup();
    const props = renderCard();

    await user.click(screen.getByRole('button', { name: /add rate/i }));

    expect(props.onAddRate).toHaveBeenCalledOnce();
  });

  it('forwards the specific rate to onEditRate and onDeleteRateRequested', async () => {
    const user = userEvent.setup();
    const props = renderCard({ rates: [lagosRate] });

    await user.click(screen.getByRole('button', { name: /edit standard/i }));
    expect(props.onEditRate).toHaveBeenCalledWith(lagosRate);

    await user.click(screen.getByRole('button', { name: /delete standard/i }));
    expect(props.onDeleteRateRequested).toHaveBeenCalledWith(lagosRate);
  });

  it('forwards the rate and next active state to onToggleRateActive', async () => {
    const user = userEvent.setup();
    const props = renderCard({ rates: [lagosRate] });

    await user.click(
      screen.getByRole('switch', { name: /deactivate standard/i })
    );

    expect(props.onToggleRateActive).toHaveBeenCalledWith(lagosRate, false);
  });

  it('marks the toggling rate as busy via isToggling', () => {
    renderCard({ rates: [lagosRate], togglingRateId: lagosRate.id });

    expect(
      screen.getByRole('switch', { name: /deactivate standard/i })
    ).toBeDisabled();
  });
});
