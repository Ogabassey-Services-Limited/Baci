import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onBlur,
      onChangeText,
      onFocus,
      placeholder,
      value,
    }: {
      onBlur?: () => void;
      onChangeText?: (value: string) => void;
      onFocus?: () => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        value: value ?? '',
        placeholder,
        onBlur,
        onFocus,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');

  return {
    default: {
      View: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', null, children),
    },
    FadeInUp: { delay: () => ({ duration: () => ({}) }) },
  };
});

vi.mock('react-native-phone-number-input', async () => {
  const React = await import('react');
  let mountCounter = 0;

  function MockPhoneInput({
    defaultValue,
    onChangeFormattedText,
    textInputProps,
  }: {
    defaultValue?: string;
    onChangeFormattedText?: (value: string) => void;
    textInputProps?: {
      onBlur?: () => void;
      onFocus?: () => void;
    };
  }) {
    const mountId = React.useRef(++mountCounter);

    return React.createElement('input', {
      'aria-label': 'Phone Number',
      'data-mount-id': String(mountId.current),
      defaultValue: defaultValue ?? '',
      onBlur: textInputProps?.onBlur,
      onFocus: textInputProps?.onFocus,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        onChangeFormattedText?.(event.target.value),
    });
  }

  return {
    default: MockPhoneInput,
  };
});

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

import { ContactInfoForm } from '@/components/customer-edit/ContactInfoForm';

function createInputStyle() {
  return {
    input: [{ borderColor: '#334155' }],
    label: [{ color: '#cbd5e1' }],
    state: {
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      color: '#f8fafc',
      shadowColor: '#3b82f6',
      shadowOpacity: 0,
    },
  };
}

describe('ContactInfoForm', () => {
  it('renders email and phone fields and forwards interactions', () => {
    const onEmailChange = vi.fn();
    const onFocusField = vi.fn();
    const onPhoneChange = vi.fn();

    render(
      <ContactInfoForm
        colors={{
          background: '#020617',
          backgroundLight: '#1e293b',
          border: '#334155',
          card: '#111827',
          primary: '#3b82f6',
          primaryLight: '#dbeafe',
          text: '#f8fafc',
          textMuted: '#94a3b8',
          textSecondary: '#cbd5e1',
        }}
        customerId="customer-1"
        email="john@example.com"
        inputStyle={createInputStyle}
        isDark
        onEmailChange={onEmailChange}
        onFocusField={onFocusField}
        onPhoneChange={onPhoneChange}
        phone="8012345678"
        shadows={{ md: {}, sm: {} }}
      />
    );

    expect(screen.getByText('Contact Info')).toBeTruthy();
    expect(screen.getByText('Email Address *')).toBeTruthy();
    expect(screen.getByText('Phone Number')).toBeTruthy();

    const emailInput = screen.getByDisplayValue('john@example.com');
    const phoneInput = screen.getByLabelText('Phone Number');

    expect(phoneInput.getAttribute('data-mount-id')).toBeTruthy();

    fireEvent.focus(emailInput);
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } });
    fireEvent.blur(emailInput);

    fireEvent.focus(phoneInput);
    fireEvent.change(phoneInput, { target: { value: '08099999999' } });
    fireEvent.blur(phoneInput);

    expect(onEmailChange).toHaveBeenCalledWith('jane@example.com');
    expect(onPhoneChange).toHaveBeenCalledWith('08099999999');
    expect(onFocusField).toHaveBeenCalledWith('email');
    expect(onFocusField).toHaveBeenCalledWith('phone');
    expect(onFocusField).toHaveBeenCalledWith(null);
  });

  it('uses a stable customer-based PhoneInput key', () => {
    const onEmailChange = vi.fn();
    const onFocusField = vi.fn();
    const onPhoneChange = vi.fn();

    const { rerender } = render(
      <ContactInfoForm
        colors={{
          background: '#020617',
          backgroundLight: '#1e293b',
          border: '#334155',
          card: '#111827',
          primary: '#3b82f6',
          primaryLight: '#dbeafe',
          text: '#f8fafc',
          textMuted: '#94a3b8',
          textSecondary: '#cbd5e1',
        }}
        customerId="customer-1"
        email="john@example.com"
        inputStyle={createInputStyle}
        isDark
        onEmailChange={onEmailChange}
        onFocusField={onFocusField}
        onPhoneChange={onPhoneChange}
        phone="8012345678"
        shadows={{ md: {}, sm: {} }}
      />
    );

    const firstMountId = screen
      .getByLabelText('Phone Number')
      .getAttribute('data-mount-id');

    rerender(
      <ContactInfoForm
        colors={{
          background: '#020617',
          backgroundLight: '#1e293b',
          border: '#334155',
          card: '#111827',
          primary: '#3b82f6',
          primaryLight: '#dbeafe',
          text: '#f8fafc',
          textMuted: '#94a3b8',
          textSecondary: '#cbd5e1',
        }}
        customerId="customer-1"
        email="john@example.com"
        inputStyle={createInputStyle}
        isDark
        onEmailChange={onEmailChange}
        onFocusField={onFocusField}
        onPhoneChange={onPhoneChange}
        phone="8099999999"
        shadows={{ md: {}, sm: {} }}
      />
    );

    const secondMountId = screen
      .getByLabelText('Phone Number')
      .getAttribute('data-mount-id');

    expect(firstMountId).not.toBeNull();
    expect(secondMountId).not.toBeNull();
    expect(firstMountId).toBe(secondMountId);
  });
});
