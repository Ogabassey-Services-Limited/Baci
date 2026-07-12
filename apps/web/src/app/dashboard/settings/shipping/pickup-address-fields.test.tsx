import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PickupAddressFields } from './pickup-address-fields';

describe('PickupAddressFields', () => {
  it('renders existing values in each field', () => {
    render(
      <PickupAddressFields
        value={{
          label: 'Main Store',
          address: '12 Adeola Odeku Street',
          city: 'Lagos',
          state: 'Lagos',
          instructions: 'Ask for the front desk',
        }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/location name/i)).toHaveValue('Main Store');
    expect(screen.getByLabelText(/^address$/i)).toHaveValue(
      '12 Adeola Odeku Street'
    );
    expect(screen.getByLabelText(/^city$/i)).toHaveValue('Lagos');
    expect(screen.getByLabelText(/^state$/i)).toHaveValue('Lagos');
    expect(screen.getByLabelText(/pickup instructions/i)).toHaveValue(
      'Ask for the front desk'
    );
  });

  it('renders blank inputs when the value has no fields set', () => {
    render(<PickupAddressFields value={{}} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/location name/i)).toHaveValue('');
    expect(screen.getByLabelText(/^address$/i)).toHaveValue('');
  });

  it('merges a field edit into the existing value', () => {
    const handleChange = vi.fn();
    render(
      <PickupAddressFields
        value={{ address: '12 Adeola Odeku Street' }}
        onChange={handleChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/^city$/i), {
      target: { value: 'Lagos' },
    });

    expect(handleChange).toHaveBeenCalledWith({
      address: '12 Adeola Odeku Street',
      city: 'Lagos',
    });
  });

  it('clears a field to undefined when emptied', () => {
    const handleChange = vi.fn();
    render(
      <PickupAddressFields
        value={{ address: '12 Adeola Odeku Street', city: 'Lagos' }}
        onChange={handleChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/^city$/i), {
      target: { value: '' },
    });

    expect(handleChange).toHaveBeenCalledWith({
      address: '12 Adeola Odeku Street',
      city: undefined,
    });
  });

  it('marks the address field as required', () => {
    render(<PickupAddressFields value={{}} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/^address$/i)).toBeRequired();
  });
});
