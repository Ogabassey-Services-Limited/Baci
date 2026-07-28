import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RegisterBusinessStep } from './RegisterBusinessStep';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/CountryPickerModal', () => ({
  CountryPickerModal: ({
    onClose,
    onSelect,
    selectedCountry,
    visible,
  }: {
    onClose: () => void;
    onSelect: (country: {
      code: string;
      currency: string;
      currencySymbol: string;
      name: string;
    }) => void;
    selectedCountry: string;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label="country picker">
        <span>{selectedCountry}</span>
        <button
          aria-label="Ghana"
          onClick={() =>
            onSelect({
              code: 'GH',
              currency: 'GHS',
              currencySymbol: '₵',
              name: 'Ghana',
            })
          }
          type="button"
        />
        <button
          aria-label="Close country picker"
          onClick={onClose}
          type="button"
        />
      </section>
    ) : null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => null,
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { 'aria-label': accessibilityLabel, onClick: onPress },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/components/auth/BusinessTypeSelector', () => ({
  BusinessTypeSelector: () => null,
}));

vi.mock('@/components/auth/register/RegisterLegalText', () => ({
  RegisterLegalText: () => null,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#000000',
      card: '#000000',
      inputBg: '#000000',
      primary: '#000000',
      text: '#ffffff',
      textMuted: '#000000',
      textOnPrimary: '#ffffff',
      textSecondary: '#000000',
    },
  }),
}));

function renderStep({
  businessType = '',
  country = 'NG',
}: { businessType?: string; country?: string } = {}) {
  const onCountryChange = vi.fn();
  render(
    <RegisterBusinessStep
      formData={{
        businessName: '',
        businessType,
        country,
        otherBusinessType: '',
        slug: '',
      }}
      isLoading={false}
      onBusinessNameChange={vi.fn()}
      onBusinessTypeChange={vi.fn()}
      onCountryChange={onCountryChange}
      onLaunchStore={vi.fn()}
      onOtherBusinessTypeChange={vi.fn()}
      onSlugChange={vi.fn()}
    />
  );

  return { onCountryChange };
}

describe('RegisterBusinessStep conditional business type', () => {
  it('shows Please specify between Business Type and Country / Region when Other is selected', () => {
    renderStep({ businessType: 'other' });

    const specifyInput = screen.getByLabelText('Please specify');
    const countrySelector = screen.getByRole('button', {
      name: 'Country / Region, Nigeria',
    });

    expect(
      specifyInput.compareDocumentPosition(countrySelector) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('RegisterBusinessStep business name normalization', () => {
  it('capitalizes every word typed or pasted into Business Name', () => {
    const onBusinessNameChange = vi.fn();
    render(
      <RegisterBusinessStep
        formData={{
          businessName: '',
          businessType: '',
          country: 'NG',
          otherBusinessType: '',
          slug: '',
        }}
        isLoading={false}
        onBusinessNameChange={onBusinessNameChange}
        onBusinessTypeChange={vi.fn()}
        onCountryChange={vi.fn()}
        onLaunchStore={vi.fn()}
        onOtherBusinessTypeChange={vi.fn()}
        onSlugChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: "o'rEILLY mary-jANE fASHION hOUSE" },
    });

    expect(onBusinessNameChange).toHaveBeenCalledWith(
      "O'Reilly Mary-Jane Fashion House"
    );
  });
});

describe('RegisterBusinessStep country selector', () => {
  it('shows the selected country and opens the searchable picker', () => {
    renderStep({ country: 'NG' });

    expect(
      screen.getByRole('button', { name: 'Country / Region, Nigeria' })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('country picker')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Country / Region, Nigeria' })
    );

    expect(screen.getByLabelText('country picker')).toBeInTheDocument();
    expect(screen.getByText('NG')).toBeInTheDocument();
  });

  it('stores the selected country code and closes the picker', () => {
    const { onCountryChange } = renderStep({ country: 'NG' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Country / Region, Nigeria' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ghana' }));

    expect(onCountryChange).toHaveBeenCalledWith('GH');
    expect(screen.queryByLabelText('country picker')).not.toBeInTheDocument();
  });

  it('closes without changing the selected country', () => {
    const { onCountryChange } = renderStep({ country: 'NG' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Country / Region, Nigeria' })
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Close country picker' })
    );

    expect(onCountryChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('country picker')).not.toBeInTheDocument();
  });
});
