import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import ProfileEditScreen from '@/app/profile/edit';

const mockUpdateProfile = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: {
    back: jest.fn(),
  },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => {
    const { View: MockView } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return <MockView {...props}>{children}</MockView>;
  },
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    error: jest.fn(),
    success: jest.fn(),
    Toast: () => null,
  }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useRequireAuth: () => ({
    isLoading: false,
    redirectTo: null,
  }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: {
      customer: {
        email: string;
        first_name: string;
        last_name: string;
        phone: string;
      };
      updateProfile: typeof mockUpdateProfile;
    }) => unknown
  ) =>
    selector({
      customer: {
        email: 'shopper@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone: '08012345678',
      },
      updateProfile: mockUpdateProfile,
    }),
}));

describe('ProfileEditScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfile.mockResolvedValue({ success: true });
  });

  it('keeps the fixed save footer inside the shared keyboard container', () => {
    render(<ProfileEditScreen />);

    const keyboardContainer = screen.getByTestId('keyboard-container');
    const saveAction = screen.getByText('Save Changes');

    expect(keyboardContainer).toContainElement(saveAction);
    expect(screen.getByTestId('keyboard-aware-scroll-view')).toBeOnTheScreen();
  });
});
