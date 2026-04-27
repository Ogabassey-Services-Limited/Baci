import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AddressEmptyState } from '@/app/addresses/AddressEmptyState';

const colors = {
  background: '#FFFFFF',
  border: '#E5E7EB',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
};

describe('AddressEmptyState', () => {
  it('renders the empty state and triggers the add action', () => {
    const onAddPress = jest.fn();

    render(<AddressEmptyState colors={colors} onAddPress={onAddPress} />);

    expect(screen.getByText('No saved addresses')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Add Address' }));

    expect(onAddPress).toHaveBeenCalledTimes(1);
  });
});
