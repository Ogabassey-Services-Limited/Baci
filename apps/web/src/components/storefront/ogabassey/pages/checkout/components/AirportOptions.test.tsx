import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AirportOptions } from './AirportOptions';

describe('AirportOptions', () => {
  it('renders both airport options and updates the selected option', () => {
    const setAirportType = vi.fn();

    render(
      <AirportOptions
        airportType="delivery"
        destinationCity="Port Harcourt"
        setAirportType={setAirportType}
      />,
    );

    expect(
      screen.getByRole('group', { name: /airport delivery preference/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /airport delivery/i })).toBeChecked();
    expect(
      screen.getByText(
        'Delivery to your doorstep is available. Choose delivery to your location or pickup at the airport.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Delivery to your doorstep')).toBeInTheDocument();
    expect(screen.getByText('Port Harcourt Airport Delivery')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /airport pickup/i }));

    expect(setAirportType).toHaveBeenCalledWith('pickup');
  });

  it('switches from pickup to airport delivery', () => {
    const setAirportType = vi.fn();

    render(
      <AirportOptions
        airportType="pickup"
        destinationCity="Port Harcourt"
        setAirportType={setAirportType}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /airport delivery/i }));

    expect(setAirportType).toHaveBeenCalledWith('delivery');
  });

  it('supports keyboard selection of airport options', async () => {
    const user = userEvent.setup();
    const setAirportType = vi.fn();

    render(
      <AirportOptions
        airportType="delivery"
        destinationCity="Port Harcourt"
        setAirportType={setAirportType}
      />,
    );

    const pickup = screen.getByRole('radio', { name: /airport pickup/i });
    pickup.focus();
    await user.keyboard('[Space]');

    expect(setAirportType).toHaveBeenCalledWith('pickup');
  });

  it('reflects the selected airport option with native radio state', () => {
    render(
      <AirportOptions
        airportType="pickup"
        destinationCity="Port Harcourt"
        setAirportType={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: /airport pickup/i })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /airport delivery/i }),
    ).not.toBeChecked();
  });

  it('uses generic airport labels when the destination city is blank', () => {
    render(
      <AirportOptions
        airportType="delivery"
        destinationCity="   "
        setAirportType={vi.fn()}
      />,
    );

    expect(screen.getByText('Airport Delivery')).toBeInTheDocument();
    expect(screen.getByText('Airport Pickup')).toBeInTheDocument();
  });
});
