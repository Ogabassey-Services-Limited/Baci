import type { ReactNode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import ProfileEditScreen from '@/app/profile/edit';

const mockBack = jest.fn();
const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: {
    back: () => mockBack(),
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
    error: (message: string) => mockToastError(message),
    success: (message: string) => mockToastSuccess(message),
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
        phone: '00000000000',
      },
      updateProfile: mockUpdateProfile,
    }),
}));

describe('ProfileEditScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfile.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the fixed save footer inside the shared keyboard container', () => {
    render(<ProfileEditScreen />);

    const keyboardContainer = screen.getByTestId('keyboard-container');
    const saveAction = screen.getByText('Save Changes');

    expect(keyboardContainer).toContainElement(saveAction);
    expect(screen.getByLabelText('First Name')).toBeOnTheScreen();
  });

  it('updates the profile and navigates back after the success toast', async () => {
    jest.useFakeTimers();

    render(<ProfileEditScreen />);

    fireEvent.changeText(screen.getByLabelText('First Name'), 'Grace');
    fireEvent.press(screen.getByLabelText('Save Changes'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        first_name: 'Grace',
        last_name: 'Lovelace',
        phone: '00000000000',
      });
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Profile updated successfully'
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows the profile update error returned by the store', async () => {
    mockUpdateProfile.mockResolvedValueOnce({
      error: 'Phone number is invalid',
      success: false,
    });

    render(<ProfileEditScreen />);

    fireEvent.changeText(screen.getByLabelText('First Name'), 'Grace');
    fireEvent.press(screen.getByLabelText('Save Changes'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Phone number is invalid');
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows a generic error when profile update throws', async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error('network failed'));

    render(<ProfileEditScreen />);

    fireEvent.changeText(screen.getByLabelText('First Name'), 'Grace');
    fireEvent.press(screen.getByLabelText('Save Changes'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Something went wrong. Please try again.'
      );
    });
    expect(mockBack).not.toHaveBeenCalled();
  });
});
