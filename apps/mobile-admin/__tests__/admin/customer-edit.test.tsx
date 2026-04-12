import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_KEYBOARD_CONTAINER_LABEL } from '../auth/app-keyboard-container.mock';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  back: vi.fn(),
  mutateAsync: vi.fn(),
  useCustomer: vi.fn(),
  useUpdateCustomer: vi.fn(),
}));

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import(
    '../auth/app-form-screen.mock'
  );
  return createAppFormScreenMock();
});

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Alert: { alert: mocks.alert },
    Pressable: ({
      children,
      onPress,
      disabled,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        'button',
        { disabled, onClick: () => onPress?.() },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      value,
      onChangeText,
      placeholder,
    }: {
      value?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
    }) =>
      React.createElement('input', {
        value: value ?? '',
        placeholder,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => ({ id: 'customer-1' }),
  useRouter: () => ({
    back: mocks.back,
  }),
}));

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');

  return {
    default: {
      View: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', null, children),
    },
    FadeIn: { duration: () => ({}) },
    FadeInUp: { delay: () => ({ duration: () => ({}) }) },
  };
});

vi.mock('react-native-phone-number-input', async () => {
  const React = await import('react');

  return {
    default: ({
      onChangeFormattedText,
    }: {
      onChangeFormattedText?: (text: string) => void;
    }) =>
      React.createElement('input', {
        'aria-label': 'Phone Number',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeFormattedText?.(event.target.value),
      }),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#0f172a',
      backgroundLight: '#1e293b',
      border: '#334155',
      card: '#111827',
      primary: '#3b82f6',
      primaryLight: '#dbeafe',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textSecondary: '#cbd5e1',
    },
    isDark: true,
    shadows: {
      sm: {},
      md: {},
    },
  }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomer: mocks.useCustomer,
  useUpdateCustomer: mocks.useUpdateCustomer,
}));

vi.mock('@/lib/sanitize', () => ({
  isValidEmail: (value: string) => value.includes('@'),
  sanitizeAddress: (value: string) => value,
  sanitizeCustomerName: (value: string) => value,
  sanitizeEmail: (value: string) => value,
  sanitizePhone: (value: string) => value,
}));

import CustomerEditScreen from '@/app/(admin)/customer/edit/[id]';

describe('CustomerEditScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCustomer.mockReturnValue({
      data: {
        id: 'customer-1',
        first_name: 'John',
        last_name: 'Doe',
        full_name: 'John Doe',
        email: 'john@example.com',
        phone: '+2348012345678',
        address: '12 Allen Avenue',
      },
      isLoading: false,
    });
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.useUpdateCustomer.mockReturnValue({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    });
  });

  it('renders the edit form inside the shared form shell', () => {
    render(<CustomerEditScreen />);

    expect(
      screen.getByRole('region', { name: APP_KEYBOARD_CONTAINER_LABEL })
    ).toBeTruthy();
    expect(screen.getByText('Personal Details')).toBeTruthy();
    expect(screen.getByDisplayValue('John')).toBeTruthy();
    expect(screen.getByDisplayValue('Doe')).toBeTruthy();
  });

  it('submits customer updates and returns to the previous screen', async () => {
    render(<CustomerEditScreen />);

    fireEvent.change(screen.getByDisplayValue('John'), {
      target: { value: 'Jane' },
    });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'customer-1',
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'john@example.com',
        })
      );
    });

    const successCall = mocks.alert.mock.calls.find(
      (call) => call[0] === 'Success'
    );
    expect(successCall).toBeTruthy();
    successCall?.[2]?.[0]?.onPress?.();
    expect(mocks.back).toHaveBeenCalled();
  });

  it('shows an error alert and stays on the form when save fails', async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error('save failed'));

    render(<CustomerEditScreen />);

    fireEvent.change(screen.getByDisplayValue('John'), {
      target: { value: 'Jane' },
    });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'customer-1',
          first_name: 'Jane',
        })
      );
    });

    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to update customer'
    );
    expect(mocks.back).not.toHaveBeenCalled();
  });
});
