import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';

const hoistedNativeFieldState = vi.hoisted(() => ({
  addressProps: null as Record<string, unknown> | null,
  phoneProps: [] as Record<string, unknown>[],
}));

export const nativeFieldState = hoistedNativeFieldState;

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
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
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
      onChange={(event) => editable && onChangeText?.(event.target.value)}
      readOnly={!editable}
      value={value ?? ''}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { StoreSettingsDetailsCard } from './StoreSettingsDetailsCard';

export const callbacks = {
  onAddressChange: vi.fn(),
  onBusinessNameChange: vi.fn(),
  onEmailChange: vi.fn(),
  onOpenCountryPicker: vi.fn(),
  onPhoneChange: vi.fn(),
  onSlugChange: vi.fn(),
  onSupportPhoneChange: vi.fn(),
};

export const defaultCardProps = {
  address: '12 Allen Avenue',
  businessName: 'Baci Foods',
  colors: LIGHT_COLORS,
  countryCode: 'NG',
  countryLabel: 'Nigeria',
  currency: 'NGN',
  email: 'support@usebaci.com',
  googleMapsApiKey: 'maps-test-key',
  isDark: false,
  phone: '+2348012345678',
  shadowStyle: SHADOWS.sm,
  slug: 'baci-foods',
  slugLocked: false,
  supportPhone: '+2347000000000',
  ...callbacks,
};

export function renderDetailsCard(
  overrides: Partial<React.ComponentProps<typeof StoreSettingsDetailsCard>> = {}
) {
  return render(
    <StoreSettingsDetailsCard {...defaultCardProps} {...overrides} />
  );
}

export function resetDetailsCardMocks() {
  vi.clearAllMocks();
  nativeFieldState.addressProps = null;
  nativeFieldState.phoneProps = [];
}
