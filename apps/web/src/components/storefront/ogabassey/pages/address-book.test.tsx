import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SavedAddress } from '@/contexts/customer-auth-context';
import { OgabasseyV2AddressBook } from './address-book';

const addresses: SavedAddress[] = [
  {
    id: 'addr-1',
    label: 'Home',
    full_name: 'Ada Lovelace',
    phone: '+2348000000000',
    address: '12 Example Street',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    postal_code: '100001',
    is_default: false,
  },
  {
    id: 'addr-2',
    label: 'Office',
    full_name: 'Ada Lovelace',
    phone: '+2348111111111',
    address: '8 Business Avenue',
    city: 'Abuja',
    state: 'FCT',
    country: 'Nigeria',
    postal_code: '900001',
    is_default: true,
  },
];

describe('OgabasseyV2AddressBook', () => {
  it('reveals action controls for keyboard users and gives them accessible names', () => {
    render(
      <OgabasseyV2AddressBook
        addresses={addresses}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onSetDefault={vi.fn()}
      />
    );

    const editButton = screen.getByRole('button', {
      name: 'Edit Home address',
    });
    const deleteButton = screen.getByRole('button', {
      name: 'Delete Home address',
    });

    expect(editButton).toHaveAttribute('title', 'Edit Home address');
    expect(deleteButton).toHaveAttribute('title', 'Delete Home address');
    expect(editButton.parentElement).toHaveClass('group-focus-within:opacity-100');
  });

  it('calls onAdd and onSetDefault from their visible actions', () => {
    const onAdd = vi.fn();
    const onSetDefault = vi.fn();

    render(
      <OgabasseyV2AddressBook
        addresses={addresses}
        onAdd={onAdd}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onSetDefault={onSetDefault}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add new/i }));
    fireEvent.click(screen.getByRole('button', { name: /set as default/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onSetDefault).toHaveBeenCalledWith('addr-1');
  });
});
