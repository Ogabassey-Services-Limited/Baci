import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaxSettingsAddressCard } from './tax-settings-address-card';

const mockToast = vi.fn();

vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('TaxSettingsAddressCard', () => {
  const onSaveAddress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSaveAddress.mockResolvedValue(undefined);
  });

  it('saves the selected Nigerian state with the registered address', async () => {
    render(
      <TaxSettingsAddressCard
        initialRegisteredAddress={{
          street: '1 Market Street',
          city: 'Lagos',
          state: 'Lagos',
          postal_code: '100001',
        }}
        initialStateCode="NG-LA"
        onSaveAddress={onSaveAddress}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save address/i }));

    await waitFor(() => {
      expect(onSaveAddress).toHaveBeenCalledWith({
        registered_address: {
          street: '1 Market Street',
          city: 'Lagos',
          state: 'Lagos',
          postal_code: '100001',
          country: 'Nigeria',
        },
        state_code: 'NG-LA',
      });
    });
  });
});
