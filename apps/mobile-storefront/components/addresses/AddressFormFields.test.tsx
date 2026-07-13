import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { AddressFormFields } from './AddressFormFields';
import type { AddressFormData } from './types';

describe('AddressFormFields', () => {
  const form: AddressFormData = {
    address: '',
    city: '',
    full_name: '',
    is_default: false,
    label: 'Home',
    phone: '',
    postal_code: '',
    state: 'Lagos',
  };

  it('renders field validation and reports label, state, and default updates', () => {
    const onUpdateField = jest.fn();

    render(
      <AddressFormFields
        colors={Colors.light}
        errors={{
          address: 'Address is required',
          city: 'City is required',
          full_name: 'Name is required',
          phone: 'Phone number is required',
        }}
        form={form}
        onUpdateField={onUpdateField}
      />
    );

    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(screen.getByText('Phone number is required')).toBeTruthy();
    expect(screen.getByText('Address is required')).toBeTruthy();
    expect(screen.getByText('City is required')).toBeTruthy();

    fireEvent.press(
      screen.getByRole('button', { name: 'Use Office address label' })
    );
    fireEvent.press(screen.getByRole('button', { name: 'Select Abia state' }));
    fireEvent.press(
      screen.getByRole('checkbox', { name: 'Set as default address' })
    );

    expect(onUpdateField).toHaveBeenNthCalledWith(1, 'label', 'Office');
    expect(onUpdateField).toHaveBeenNthCalledWith(2, 'state', 'Abia');
    expect(onUpdateField).toHaveBeenNthCalledWith(3, 'is_default', true);
  });

  it('reports text input changes without owning persistence state', () => {
    const onUpdateField = jest.fn();

    render(
      <AddressFormFields
        colors={Colors.light}
        errors={{}}
        form={form}
        onUpdateField={onUpdateField}
      />
    );

    fireEvent.changeText(screen.getByLabelText('Full Name'), 'Ada Customer');
    fireEvent.changeText(screen.getByLabelText('Phone Number'), '08031234567');
    fireEvent.changeText(
      screen.getByLabelText('Street Address'),
      '12 Test Avenue'
    );
    fireEvent.changeText(screen.getByLabelText('City'), 'Ikeja');
    fireEvent.changeText(screen.getByLabelText('Postal Code'), '100001');

    expect(onUpdateField).toHaveBeenNthCalledWith(
      1,
      'full_name',
      'Ada Customer'
    );
    expect(onUpdateField).toHaveBeenNthCalledWith(2, 'phone', '08031234567');
    expect(onUpdateField).toHaveBeenNthCalledWith(
      3,
      'address',
      '12 Test Avenue'
    );
    expect(onUpdateField).toHaveBeenNthCalledWith(4, 'city', 'Ikeja');
    expect(onUpdateField).toHaveBeenNthCalledWith(5, 'postal_code', '100001');
  });
});
