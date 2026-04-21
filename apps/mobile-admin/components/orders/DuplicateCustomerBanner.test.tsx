import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import type { SelectableCustomer } from './new-order.types';
import { DuplicateCustomerBanner } from './DuplicateCustomerBanner';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('DuplicateCustomerBanner', () => {
  it('reuses the duplicate customer and resets the create flow', () => {
    const duplicateCustomer: SelectableCustomer = {
      address: '12 Allen Avenue',
      email: 'ada@example.com',
      first_name: 'Ada',
      id: 'customer-1',
      last_name: 'Lovelace',
      phone: '08012345678',
    };
    const handleSelectCustomer = vi.fn();
    const resetNewCustomerForm = vi.fn();
    const setDuplicateCustomer = vi.fn();
    const setIsCreatingCustomer = vi.fn();

    render(
      <DuplicateCustomerBanner
        colors={LIGHT_COLORS}
        duplicateCustomer={duplicateCustomer}
        handleSelectCustomer={handleSelectCustomer}
        resetNewCustomerForm={resetNewCustomerForm}
        setDuplicateCustomer={setDuplicateCustomer}
        setIsCreatingCustomer={setIsCreatingCustomer}
      />
    );

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('08012345678')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(handleSelectCustomer).toHaveBeenCalledWith(duplicateCustomer);
    expect(setDuplicateCustomer).toHaveBeenCalledWith(null);
    expect(setIsCreatingCustomer).toHaveBeenCalledWith(false);
    expect(resetNewCustomerForm).toHaveBeenCalledTimes(1);
  });
});
