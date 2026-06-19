import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AirportOption } from './AirportOption';

describe('AirportOption', () => {
  it('selects its airport preference', () => {
    const setAirportType = vi.fn();

    render(
      <AirportOption
        type="pickup"
        label="Airport Pickup"
        description="Collect at the airport"
        price="₦20,000"
        airportType="delivery"
        setAirportType={setAirportType}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /airport pickup/i }));

    expect(setAirportType).toHaveBeenCalledWith('pickup');
  });

  it('selects its airport preference from the keyboard', async () => {
    const user = userEvent.setup();
    const setAirportType = vi.fn();

    render(
      <AirportOption
        type="pickup"
        label="Airport Pickup"
        description="Collect at the airport"
        price="₦20,000"
        airportType="delivery"
        setAirportType={setAirportType}
      />,
    );

    const radio = screen.getByRole('radio', { name: /airport pickup/i });
    radio.focus();
    await user.keyboard('[Space]');

    expect(setAirportType).toHaveBeenCalledWith('pickup');
  });
});
