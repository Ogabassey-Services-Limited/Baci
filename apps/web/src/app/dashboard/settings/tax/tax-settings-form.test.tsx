import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaxSettingsForm } from './tax-settings-form';

const mockApiPatch = vi.fn();
const mockApiPost = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: (
    props: React.InputHTMLAttributes<HTMLInputElement> & {
      onSelect?: unknown;
    }
  ) => {
    const { onSelect: _onSelect, ...inputProps } = props;
    return <input {...inputProps} />;
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const defaultProps = {
  initialVatEnabled: false,
  initialVatRate: 7.5,
  initialTaxId: '',
  initialLegalEntityName: '',
  initialRegisteredAddress: {
    street: '',
    city: '',
    state: '',
    postal_code: '',
  },
  initialStateCode: '',
};

describe('TaxSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPatch.mockResolvedValue({ merchant: { id: 'merchant-1' } });
    mockApiPost.mockResolvedValue({
      verified: true,
      merchant: { id: 'merchant-1' },
      taxIdentificationNumber: '2522599781276',
    });
  });

  it('renders all card sections', () => {
    render(<TaxSettingsForm {...defaultProps} />);

    expect(screen.getByText('VAT Collection')).toBeDefined();
    expect(screen.getByText('Tax Identification')).toBeDefined();
    expect(screen.getByText('Legal Entity Name')).toBeDefined();
    expect(screen.getByText('Registered Business Address')).toBeDefined();
    expect(screen.getByText('About VAT in Nigeria')).toBeDefined();
  });

  it('renders VAT rate and country info', () => {
    render(<TaxSettingsForm {...defaultProps} />);

    expect(screen.getByText('7.5%')).toBeDefined();
    expect(screen.getByText('Nigeria')).toBeDefined();
  });

  it('shows Active badge when VAT is enabled', () => {
    render(<TaxSettingsForm {...defaultProps} initialVatEnabled />);

    expect(screen.getByText('Active')).toBeDefined();
  });

  it('saves VAT changes through the merchant settings API', async () => {
    render(<TaxSettingsForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/settings', {
        vat_registration_status: 'registered',
      });
    });
  });

  it('shows an error toast when VAT save fails', async () => {
    mockApiPatch.mockRejectedValueOnce(new Error('VAT update failed'));

    render(<TaxSettingsForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Update Failed',
          variant: 'destructive',
        })
      );
    });
  });

  it('renders Tax ID input with initial CAC-returned 13-digit value', () => {
    render(<TaxSettingsForm {...defaultProps} initialTaxId="2522599781276" />);

    const input = screen.getByLabelText('Tax Identification Number (TIN)');
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('2522599781276');
  });

  it('verifies a CAC-returned 13-digit TIN before saving', async () => {
    render(
      <TaxSettingsForm
        {...defaultProps}
        initialLegalEntityName="OGABASSEY SERVICES LIMITED"
      />
    );

    const input = screen.getByLabelText(
      'Tax Identification Number (TIN)'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2522599781276' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify & Save',
      })
    );

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/merchant/verify-tax-id', {
        taxIdentificationNumber: '2522599781276',
        legalEntityName: 'OGABASSEY SERVICES LIMITED',
      });
      expect(mockApiPatch).not.toHaveBeenCalledWith(
        '/api/merchant/settings',
        expect.objectContaining({
          tax_identification_number: expect.anything(),
        })
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Tax ID Verified' })
      );
    });
  });

  it('rejects invalid TIN values before calling the API', async () => {
    render(<TaxSettingsForm {...defaultProps} />);

    const input = screen.getByLabelText(
      'Tax Identification Number (TIN)'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123456789' } });
    const saveButton = screen.getByRole('button', { name: 'Verify & Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockApiPatch).not.toHaveBeenCalled();
      expect(mockApiPost).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Invalid Tax ID',
          variant: 'destructive',
        })
      );
    });
  });

  it('renders Legal Entity Name input with initial value', () => {
    render(
      <TaxSettingsForm {...defaultProps} initialLegalEntityName="Acme Ltd" />
    );

    const input = screen.getByLabelText('Registered Business Name');
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('Acme Ltd');
  });

  it('renders address fields with initial values', () => {
    render(
      <TaxSettingsForm
        {...defaultProps}
        initialRegisteredAddress={{
          street: '123 Marina Road',
          city: 'Lagos',
          state: 'Lagos',
          postal_code: '100001',
        }}
      />
    );

    expect(
      (screen.getByLabelText('Street Address') as HTMLInputElement).value
    ).toBe('123 Marina Road');
    expect((screen.getByLabelText('City') as HTMLInputElement).value).toBe(
      'Lagos'
    );
    expect(
      (screen.getByLabelText('Postal Code') as HTMLInputElement).value
    ).toBe('100001');
  });

  it('renders state dropdown with all 37 Nigerian states', () => {
    render(<TaxSettingsForm {...defaultProps} />);

    const select = screen.getByLabelText('State') as HTMLSelectElement;
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(38);
    expect(options[0].textContent).toBe('Select state...');
  });
});
