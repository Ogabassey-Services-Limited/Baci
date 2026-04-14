import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { StoreSettingsDetailsCard } from './StoreSettingsDetailsCard';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (text: string) => void;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      value={value ?? ''}
    />
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe('StoreSettingsDetailsCard', () => {
  const callbacks = {
    onAddressChange: vi.fn(),
    onBusinessNameChange: vi.fn(),
    onEmailChange: vi.fn(),
    onOpenCountryPicker: vi.fn(),
    onPhoneChange: vi.fn(),
    onSlugChange: vi.fn(),
  };

  const renderCard = () =>
    render(
      <StoreSettingsDetailsCard
        address="12 Allen Avenue"
        businessName="Baci Foods"
        colors={LIGHT_COLORS}
        countryLabel="Nigeria"
        currency="NGN"
        email="support@usebaci.com"
        phone="+2348012345678"
        shadowStyle={SHADOWS.sm}
        slug="baci-foods"
        {...callbacks}
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the current values', () => {
    renderCard();

    expect(screen.getByDisplayValue('Baci Foods')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+2348012345678')).toBeInTheDocument();
    expect(screen.getByDisplayValue('support@usebaci.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12 Allen Avenue')).toBeInTheDocument();
    expect(screen.getByDisplayValue('baci-foods')).toBeInTheDocument();
    expect(screen.getByText('Nigeria')).toBeInTheDocument();
    expect(screen.getByText('NGN')).toBeInTheDocument();
  });

  it('forwards input changes', () => {
    renderCard();

    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Stores' },
    });
    fireEvent.change(screen.getByLabelText('Phone Number'), {
      target: { value: '+2348099999999' },
    });
    fireEvent.change(screen.getByLabelText('Support Email'), {
      target: { value: 'hello@usebaci.com' },
    });
    fireEvent.change(screen.getByLabelText('Business Address'), {
      target: { value: '44 Marina' },
    });
    fireEvent.change(screen.getByLabelText('Store slug'), {
      target: { value: 'baci-stores' },
    });

    expect(callbacks.onBusinessNameChange).toHaveBeenCalledWith('Baci Stores');
    expect(callbacks.onPhoneChange).toHaveBeenCalledWith('+2348099999999');
    expect(callbacks.onEmailChange).toHaveBeenCalledWith('hello@usebaci.com');
    expect(callbacks.onAddressChange).toHaveBeenCalledWith('44 Marina');
    expect(callbacks.onSlugChange).toHaveBeenCalledWith('baci-stores');
  });

  it('forwards the country picker action', () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Select country' }));

    expect(callbacks.onOpenCountryPicker).toHaveBeenCalledTimes(1);
  });
});
