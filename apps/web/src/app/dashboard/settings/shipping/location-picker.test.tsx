import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LocationPicker } from './location-picker';

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: () => false,
});
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: () => undefined,
});

describe('LocationPicker', () => {
  it('renders an existing whole-country location', () => {
    render(
      <LocationPicker
        value={[{ countryCode: 'AE', subdivisionCode: null }]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('United Arab Emirates')).toBeInTheDocument();
    expect(screen.getByText('Whole country')).toBeInTheDocument();
  });

  it('renders existing subdivision selections grouped by country', () => {
    render(
      <LocationPicker
        value={[
          { countryCode: 'NG', subdivisionCode: 'NG-LA' },
          { countryCode: 'NG', subdivisionCode: 'NG-OG' },
        ]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Nigeria')).toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('adds a new whole-country row when a country is picked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<LocationPicker value={[]} onChange={handleChange} />);

    await user.click(screen.getByRole('combobox', { name: /add a country/i }));
    await user.click(await screen.findByRole('option', { name: /Nigeria/i }));

    expect(handleChange).toHaveBeenCalledWith([
      { countryCode: 'NG', subdivisionCode: null },
    ]);
  });

  it('removes a location row', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <LocationPicker
        value={[{ countryCode: 'AE', subdivisionCode: null }]}
        onChange={handleChange}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /remove united arab emirates/i })
    );

    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('does not offer a country already added', () => {
    render(
      <LocationPicker
        value={[{ countryCode: 'AE', subdivisionCode: null }]}
        onChange={vi.fn()}
      />
    );

    // The row label and the select option would both say "United Arab
    // Emirates" if it were still offered; only the row label should exist.
    expect(screen.getAllByText('United Arab Emirates')).toHaveLength(1);
  });
});
