import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

// --- vi.hoisted: these variables are available inside vi.mock factories ---
const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  mutateAsync: vi.fn(),
  signIn: vi.fn(),
  setNavigationBarStyle: vi.fn(),
}));

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import('./app-form-screen.mock');
  return createAppFormScreenMock();
});

vi.mock('@/components/ui/CountryPickerModal', () => ({
  CountryPickerModal: ({
    onSelect,
    visible,
  }: {
    onSelect: (country: {
      code: string;
      currency: string;
      currencySymbol: string;
      name: string;
    }) => void;
    visible: boolean;
  }) =>
    visible ? (
      <button
        aria-label="India"
        onClick={() =>
          onSelect({
            code: 'IN',
            currency: 'INR',
            currencySymbol: '₹',
            name: 'India',
          })
        }
        type="button"
      />
    ) : null,
}));

// --- Mock react-native with HTML-compatible components ---
vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    StatusBar: () => null,
    useColorScheme: vi.fn(() => 'light'),
    Alert: { alert: mocks.alert },
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      absoluteFillObject: {},
    },
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Text: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) => React.createElement('span', { onClick: onPress }, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
      secureTextEntry,
    }: {
      onChangeText?: (t: string) => void;
      placeholder?: string;
      value?: string;
      secureTextEntry?: boolean;
    }) =>
      React.createElement('input', {
        placeholder,
        value: value ?? '',
        type: secureTextEntry ? 'password' : 'text',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(e.target.value),
      }),
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
      disabled,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        'button',
        { onClick: onPress, disabled, 'aria-label': accessibilityLabel },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    ActivityIndicator: () => null,
    KeyboardAvoidingView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Linking: { openURL: vi.fn() },
    Platform: { OS: 'ios' },
  };
});

vi.mock('expo-linear-gradient', async () => {
  const React = await import('react');
  return {
    useColorScheme: vi.fn(() => 'light'),
    LinearGradient: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-navigation-bar', () => ({
  setStyle: mocks.setNavigationBarStyle,
}));

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  return {
    useColorScheme: vi.fn(() => 'light'),
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),

    default: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
    __esModule: true,
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mocks.replace,
    push: mocks.push,
    back: vi.fn(),
  }),
}));

// Mock transitive deps so the real NetworkError from @/lib/api-client can load
vi.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: 'localhost:8081' } },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock('@/hooks/useRegistration', () => ({
  useRegistration: () => ({
    register: {
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    },
    completeProfile: { mutate: vi.fn(), isPending: false },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signIn: mocks.signIn }),
}));

vi.mock('@/components/ui/AppKeyboardContainer', async () => {
  const module = await import('./app-keyboard-container.mock');
  return module.createAppKeyboardContainerMock();
});

vi.mock('@/lib/password-utils', () => ({
  validatePassword: () => ({
    isValid: true,
    strength: 3,
    error: null,
    requirements: {
      length: true,
      complexity: true,
      notCommon: true,
      match: true,
    },
  }),
}));

vi.mock('@/lib/sanitize', () => ({ getEmailError: () => null }));

// --- Helpers ---

/** Fill the 2-step registration form and click "Launch Store" */
export function fillFormAndSubmit() {
  // Step 1: Account details
  fireEvent.change(screen.getByPlaceholderText('John'), {
    target: { value: 'Test' },
  });
  fireEvent.change(screen.getByPlaceholderText('Doe'), {
    target: { value: 'User' },
  });
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: 'test@example.com' },
  });
  const passwordFields = screen.getAllByPlaceholderText('••••••••');
  fireEvent.change(passwordFields[0], {
    target: { value: 'StrongP@ss123!' },
  });
  fireEvent.change(passwordFields[1], {
    target: { value: 'StrongP@ss123!' },
  });

  // Click "Next Step" to go to step 2
  fireEvent.click(screen.getByText('Next Step'));

  // Step 2: Business info
  fireEvent.change(screen.getByPlaceholderText('My Awesome Store'), {
    target: { value: 'Test Store' },
  });
  fireEvent.click(screen.getByText('Fashion & Apparel'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Country / Region, Nigeria' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'India' }));

  // Submit the form.
  fireEvent.click(screen.getByText('Launch Store'));
}

export function getRegisterScreenMocks() {
  return mocks;
}
