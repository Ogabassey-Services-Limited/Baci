import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TaxSettingsForm } from './tax-settings-form';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  }),
}));

// Mock AddressAutocomplete as a simple input
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

// Mock useToast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const defaultProps = {
  merchantId: 'merchant-123',
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

  it('does not show Active badge when VAT is disabled', () => {
    render(<TaxSettingsForm {...defaultProps} />);

    expect(screen.queryByText('Active')).toBeNull();
  });

  it('renders Tax ID input with initial value', () => {
    render(<TaxSettingsForm {...defaultProps} initialTaxId="1234567890" />);

    const input = screen.getByLabelText('Tax Identification Number (TIN)');
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('1234567890');
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
    // 37 states + "Select state..." placeholder = 38 options
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(38);
    expect(options[0].textContent).toBe('Select state...');
  });

  it('renders state dropdown with specific states', () => {
    render(<TaxSettingsForm {...defaultProps} />);

    const select = screen.getByLabelText('State') as HTMLSelectElement;
    const optionTexts = Array.from(select.querySelectorAll('option')).map(
      (o) => o.textContent
    );

    expect(optionTexts).toContain('Lagos');
    expect(optionTexts).toContain('FCT');
    expect(optionTexts).toContain('Rivers');
    expect(optionTexts).toContain('Kano');
  });

  it('sets initial state code in dropdown', () => {
    render(<TaxSettingsForm {...defaultProps} initialStateCode="NG-LA" />);

    const select = screen.getByLabelText('State') as HTMLSelectElement;
    expect(select.value).toBe('NG-LA');
  });

  it('strips non-digit characters from TIN input', () => {
    render(<TaxSettingsForm {...defaultProps} />);

    const input = screen.getByLabelText(
      'Tax Identification Number (TIN)'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12ab34cd56' } });
    expect(input.value).toBe('123456');
  });

  it('limits TIN input to 10 digits', () => {
    render(<TaxSettingsForm {...defaultProps} />);

    const input = screen.getByLabelText(
      'Tax Identification Number (TIN)'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12345678901234' } });
    expect(input.value).toBe('1234567890');
  });

  it('updates legal entity name on input change', () => {
    render(<TaxSettingsForm {...defaultProps} />);

    const input = screen.getByLabelText(
      'Registered Business Name'
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: 'New Business Name Ltd' },
    });
    expect(input.value).toBe('New Business Name Ltd');
  });

  it('renders Save Address button', () => {
    render(<TaxSettingsForm {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Save Address/i })).toBeDefined();
  });

  it('renders FIRS info in the alert', () => {
    render(<TaxSettingsForm {...defaultProps} />);

    expect(screen.getByText(/Finance Act 2020/)).toBeDefined();
    expect(screen.getAllByText(/7\.5%/).length).toBeGreaterThanOrEqual(1);
  });
});
