import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AddressCard } from '@/app/addresses/AddressCard';
import type { Address } from '@/app/addresses/types';

const colors = {
  background: '#FFFFFF',
  border: '#E5E7EB',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
};

const address: Address = {
  id: 'address-1',
  label: 'Home',
  full_name: 'Ada Lovelace',
  phone: '08030000000',
  address: '12 Marina Road',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  postal_code: '100001',
  is_default: false,
};

describe('AddressCard', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders address details and supports the primary actions', () => {
    const onEdit = jest.fn();
    const onSetDefault = jest.fn();

    render(
      <AddressCard
        address={address}
        colors={colors}
        onDelete={jest.fn()}
        onEdit={onEdit}
        onSetDefault={onSetDefault}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Edit Home' }));
    fireEvent.press(
      screen.getByRole('button', { name: 'Set Home as default' })
    );

    expect(onEdit).toHaveBeenCalledWith(address);
    expect(onSetDefault).toHaveBeenCalledWith(address.id);
    expect(screen.getByText('Ada Lovelace')).toBeOnTheScreen();
  });

  it('shows edit, set default, and delete actions in the menu for non-default addresses', () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    render(
      <AddressCard
        address={address}
        colors={colors}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
        onSetDefault={jest.fn()}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Address options for Home' })
    );

    expect(alertSpy).toHaveBeenCalledWith(
      'Address Options',
      '',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Edit' }),
        expect.objectContaining({ text: 'Set Default' }),
        expect.objectContaining({ text: 'Delete' }),
      ])
    );
  });

  it('omits the set default menu action when the address is already default', () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    render(
      <AddressCard
        address={{ ...address, is_default: true }}
        colors={colors}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
        onSetDefault={jest.fn()}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Address options for Home' })
    );

    const actions = alertSpy.mock.calls[0]?.[2] ?? [];

    expect(actions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ text: 'Set Default' })])
    );
  });
});
