import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ShippingQuote } from '../types';
import { AirportDeliveryOptions } from './AirportDeliveryOptions';

const airQuote: ShippingQuote = {
  id: 'air-quote',
  provider: 'GIGL',
  serviceTier: 'GoFaster',
  carrierName: 'GIGL',
  displayName: 'GIGL Air Cargo',
  estimatedDays: 1,
  price: 18_500,
  currency: 'NGN',
  pickupIncluded: false,
  insuranceIncluded: false,
};

function renderAirportOptions(
  overrides: Partial<ComponentProps<typeof AirportDeliveryOptions>> = {},
) {
  return render(
    <AirportDeliveryOptions
      airportType="delivery"
      city="Ibadan"
      state="Oyo"
      selectedQuoteId=""
      selectedQuoteMatchesDeliveryMethod={false}
      airDeliveryQuotes={[]}
      onSelectAirportType={vi.fn()}
      onSelectQuote={vi.fn()}
      {...overrides}
    />,
  );
}

describe('AirportDeliveryOptions', () => {
  it('shows the fixed airport delivery and pickup prices', () => {
    renderAirportOptions();

    expect(screen.getByText('₦35,000')).toBeInTheDocument();
    expect(screen.getByText('₦20,000')).toBeInTheDocument();
    expect(screen.getByText('Ibadan Airport Delivery')).toBeInTheDocument();
  });

  it('notifies the parent when the airport type changes', async () => {
    const user = userEvent.setup();
    const onSelectAirportType = vi.fn();
    renderAirportOptions({ onSelectAirportType });

    await user.click(screen.getByRole('radio', { name: /airport pickup/i }));

    expect(onSelectAirportType).toHaveBeenCalledWith('pickup');
  });

  it('renders and selects provider GoFaster quotes', async () => {
    const user = userEvent.setup();
    const onSelectQuote = vi.fn();
    renderAirportOptions({ airDeliveryQuotes: [airQuote], onSelectQuote });

    expect(screen.getByText('GIGL Air Cargo')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /gigl air cargo/i }));

    expect(onSelectQuote).toHaveBeenCalledWith('air-quote');
  });
});
