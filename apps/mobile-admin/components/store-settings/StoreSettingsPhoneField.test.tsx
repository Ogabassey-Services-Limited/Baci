import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DARK_COLORS, SHADOWS } from '@/constants/theme';
import { StoreSettingsPhoneField } from './StoreSettingsPhoneField';

const phoneState = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

vi.mock('react-native-phone-number-input', async () => {
  const React = await import('react');
  return {
    default: (props: Record<string, unknown>) => {
      const [mountedDefaultValue] = React.useState(
        String(props.defaultValue ?? '')
      );
      phoneState.props = props;
      const countryPickerProps = props.countryPickerProps as {
        renderFlagButton?: (flagProps: {
          countryCode: string;
        }) => React.ReactNode;
      };
      return React.createElement(
        'div',
        null,
        countryPickerProps?.renderFlagButton?.({
          countryCode: String(props.defaultCode),
        }),
        props.renderDropdownImage as React.ReactNode,
        React.createElement('input', {
          'aria-label': (
            props.textInputProps as { accessibilityLabel?: string }
          ).accessibilityLabel,
          value: mountedDefaultValue,
          readOnly: true,
        })
      );
    },
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name: string }) => <span data-icon={name}>{name}</span>,
}));

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe('StoreSettingsPhoneField', () => {
  beforeEach(() => {
    phoneState.props = null;
  });

  it('renders a full-height flag-aware phone field for the active theme', () => {
    const onChange = vi.fn();

    render(
      <StoreSettingsPhoneField
        accessibilityLabel="Support Phone"
        colors={DARK_COLORS}
        countryCode="NG"
        isDark
        label="Support Phone"
        onChange={onChange}
        placeholder="Enter support phone number"
        shadowStyle={SHADOWS.sm}
        value="+2347000000000"
      />
    );

    expect(screen.getByText('Support Phone')).toBeInTheDocument();
    expect(screen.getByText('🇳🇬')).toBeInTheDocument();
    expect(screen.getByText('chevron-down')).toBeInTheDocument();
    expect(phoneState.props).toMatchObject({
      defaultCode: 'NG',
      defaultValue: '7000000000',
      withDarkTheme: true,
    });
    expect(phoneState.props?.containerStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ height: 58 })])
    );
    expect(phoneState.props?.countryPickerButtonStyle).toEqual(
      expect.objectContaining({ minWidth: 72, width: 72 })
    );

    (phoneState.props?.onChangeFormattedText as (phone: string) => void)(
      '+2347111111111'
    );
    expect(onChange).toHaveBeenCalledWith('+2347111111111');
  });

  it('uses the stored E.164 country to keep its national digits intact', () => {
    render(
      <StoreSettingsPhoneField
        accessibilityLabel="Phone Number"
        colors={DARK_COLORS}
        countryCode="NG"
        isDark
        label="Phone Number"
        onChange={vi.fn()}
        placeholder="Enter phone number"
        shadowStyle={SHADOWS.sm}
        value="+447700900123"
      />
    );

    expect(phoneState.props).toMatchObject({
      defaultCode: 'GB',
      defaultValue: '7700900123',
    });
  });

  it('remounts the native input when a same-country merchant phone changes', () => {
    const commonProps = {
      accessibilityLabel: 'Phone Number',
      colors: DARK_COLORS,
      countryCode: 'NG' as const,
      isDark: true,
      label: 'Phone Number',
      onChange: vi.fn(),
      placeholder: 'Enter phone number',
      shadowStyle: SHADOWS.sm,
    };
    const { rerender } = render(
      <StoreSettingsPhoneField {...commonProps} value="+2347000000001" />
    );

    expect(screen.getByRole('textbox', { name: 'Phone Number' })).toHaveValue(
      '7000000001'
    );

    rerender(
      <StoreSettingsPhoneField {...commonProps} value="+2348000000002" />
    );

    expect(screen.getByRole('textbox', { name: 'Phone Number' })).toHaveValue(
      '8000000002'
    );
  });
});
