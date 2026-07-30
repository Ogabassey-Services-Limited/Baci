import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DARK_COLORS, LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { StoreSettingsDetailsCard } from './StoreSettingsDetailsCard';

const nativeFieldState = vi.hoisted(() => ({
  addressProps: null as Record<string, unknown> | null,
  phoneProps: [] as Record<string, unknown>[],
}));

vi.mock('react-native-phone-number-input', async () => {
  const React = await import('react');
  return {
    default: (props: Record<string, unknown>) => {
      nativeFieldState.phoneProps.push(props);
      const textInputProps = (props.textInputProps ?? {}) as {
        accessibilityLabel?: string;
      };
      return React.createElement('input', {
        'aria-label': textInputProps.accessibilityLabel,
        defaultValue: String(props.defaultValue ?? ''),
      });
    },
  };
});

vi.mock('./StoreSettingsAddressField', async () => {
  const React = await import('react');
  return {
    StoreSettingsAddressField: (props: Record<string, unknown>) => {
      nativeFieldState.addressProps = props;
      return React.createElement('input', {
        'aria-label': 'Business Address',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          (props.onAddressChange as (value: string) => void)(
            event.target.value
          ),
        value: String(props.address ?? ''),
      });
    },
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  StatusBar: () => null,
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
    editable = true,
    onChangeText,
    value,
  }: {
    accessibilityLabel?: string;
    editable?: boolean;
    onChangeText?: (text: string) => void;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => {
        if (editable) onChangeText?.(event.target.value);
      }}
      readOnly={!editable}
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
    onSupportPhoneChange: vi.fn(),
  };

  const renderCard = () =>
    render(
      <StoreSettingsDetailsCard
        address="12 Allen Avenue"
        businessName="Baci Foods"
        colors={LIGHT_COLORS}
        countryCode="NG"
        countryLabel="Nigeria"
        currency="NGN"
        email="support@usebaci.com"
        googleMapsApiKey="maps-test-key"
        isDark={false}
        phone="+2348012345678"
        shadowStyle={SHADOWS.sm}
        slugLocked={false}
        slug="baci-foods"
        supportPhone="+2347000000000"
        {...callbacks}
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
    nativeFieldState.addressProps = null;
    nativeFieldState.phoneProps = [];
  });

  it('renders the current values', () => {
    renderCard();

    expect(screen.getByDisplayValue('Baci Foods')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8012345678')).toBeInTheDocument();
    expect(screen.getByDisplayValue('7000000000')).toBeInTheDocument();
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
    const primaryPhoneProps = nativeFieldState.phoneProps[0];
    const supportPhoneProps = nativeFieldState.phoneProps[1];
    (primaryPhoneProps.onChangeFormattedText as (value: string) => void)(
      '+2348099999999'
    );
    (supportPhoneProps.onChangeFormattedText as (value: string) => void)(
      '+2347111111111'
    );
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
    expect(callbacks.onSupportPhoneChange).toHaveBeenCalledWith(
      '+2347111111111'
    );
    expect(callbacks.onEmailChange).toHaveBeenCalledWith('hello@usebaci.com');
    expect(callbacks.onAddressChange).toHaveBeenCalledWith('44 Marina');
    expect(callbacks.onSlugChange).toHaveBeenCalledWith('baci-stores');
  });

  it('uses flag-aware phone fields tied to the selected merchant country', () => {
    renderCard();

    expect(nativeFieldState.phoneProps).toHaveLength(2);
    expect(nativeFieldState.phoneProps[0]).toMatchObject({
      defaultCode: 'NG',
      defaultValue: '8012345678',
    });
    expect(nativeFieldState.phoneProps[1]).toMatchObject({
      defaultCode: 'NG',
      defaultValue: '7000000000',
    });

    for (const phoneProps of nativeFieldState.phoneProps) {
      expect(phoneProps.containerStyle).toEqual(
        expect.arrayContaining([expect.objectContaining({ height: 58 })])
      );
      expect(phoneProps.textInputStyle).toEqual(
        expect.arrayContaining([expect.objectContaining({ height: 54 })])
      );
    }
  });

  it('resolves persisted country names before choosing the phone fallback country', () => {
    render(
      <StoreSettingsDetailsCard
        address="12 Oxford Street"
        businessName="Baci Ghana"
        colors={LIGHT_COLORS}
        countryCode="Ghana"
        countryLabel="Ghana"
        currency="GHS"
        email="support@usebaci.com"
        googleMapsApiKey="maps-test-key"
        isDark={false}
        phone="+233201234567"
        shadowStyle={SHADOWS.sm}
        slug="baci-ghana"
        slugLocked={false}
        supportPhone="+233701234567"
        {...callbacks}
      />
    );

    expect(nativeFieldState.phoneProps).toHaveLength(2);
    expect(nativeFieldState.phoneProps[0]).toMatchObject({ defaultCode: 'GH' });
    expect(nativeFieldState.phoneProps[1]).toMatchObject({ defaultCode: 'GH' });
    expect(nativeFieldState.addressProps).toMatchObject({ countryCode: 'GH' });
  });

  it('renders the phone country selector for the active color scheme', () => {
    render(
      <StoreSettingsDetailsCard
        address="12 Allen Avenue"
        businessName="Baci Foods"
        colors={DARK_COLORS}
        countryCode="NG"
        countryLabel="Nigeria"
        currency="NGN"
        email="support@usebaci.com"
        googleMapsApiKey="maps-test-key"
        isDark
        phone="+2348012345678"
        shadowStyle={SHADOWS.sm}
        slug="baci-foods"
        slugLocked={false}
        supportPhone="+2347000000000"
        {...callbacks}
      />
    );

    for (const phoneProps of nativeFieldState.phoneProps) {
      expect(phoneProps).toMatchObject({
        withDarkTheme: true,
      });
      expect(phoneProps.countryPickerButtonStyle).toEqual(
        expect.objectContaining({ minWidth: 72, width: 72 })
      );
    }
  });

  it('configures address suggestions for the selected merchant country', () => {
    renderCard();

    expect(nativeFieldState.addressProps).toMatchObject({
      address: '12 Allen Avenue',
      countryCode: 'NG',
      googleMapsApiKey: 'maps-test-key',
    });
  });

  it('keeps manual address entry available when Google Places is not configured', () => {
    render(
      <StoreSettingsDetailsCard
        address="12 Allen Avenue"
        businessName="Baci Foods"
        colors={LIGHT_COLORS}
        countryCode="NG"
        countryLabel="Nigeria"
        currency="NGN"
        email="support@usebaci.com"
        googleMapsApiKey={undefined}
        isDark={false}
        phone="+2348012345678"
        shadowStyle={SHADOWS.sm}
        slug="baci-foods"
        slugLocked={false}
        supportPhone="+2347000000000"
        {...callbacks}
      />
    );

    expect(screen.getByLabelText('Business Address')).toHaveValue(
      '12 Allen Avenue'
    );
    expect(nativeFieldState.addressProps).toMatchObject({
      googleMapsApiKey: undefined,
    });

    fireEvent.change(screen.getByLabelText('Business Address'), {
      target: { value: '14 Bode Thomas' },
    });

    expect(callbacks.onAddressChange).toHaveBeenCalledWith('14 Bode Thomas');
  });

  it('forwards the country picker action', () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Select country' }));

    expect(callbacks.onOpenCountryPicker).toHaveBeenCalledTimes(1);
  });

  it('locks the store slug input when the slug is established', () => {
    render(
      <StoreSettingsDetailsCard
        address="12 Allen Avenue"
        businessName="Baci Foods"
        colors={LIGHT_COLORS}
        countryCode="NG"
        countryLabel="Nigeria"
        currency="NGN"
        email="support@usebaci.com"
        googleMapsApiKey="maps-test-key"
        isDark={false}
        phone="+2348012345678"
        shadowStyle={SHADOWS.sm}
        slug="baci-foods"
        slugLocked
        supportPhone="+2347000000000"
        {...callbacks}
      />
    );

    const slugInput = screen.getByLabelText('Store slug');

    expect(slugInput).toHaveAttribute('readonly');
    expect(
      screen.getByText(
        'Store links are locked after setup. Contact support if you need a change.'
      )
    ).toBeInTheDocument();

    fireEvent.change(slugInput, {
      target: { value: 'baci-stores' },
    });

    expect(callbacks.onSlugChange).not.toHaveBeenCalled();
  });
});
