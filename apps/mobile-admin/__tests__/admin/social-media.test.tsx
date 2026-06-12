import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SocialMediaScreen from '@/app/(admin)/social-media';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  back: vi.fn(),
  useMerchant: vi.fn(),
  updateMerchantSettings: vi.fn(),
  useMutation: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('expo-router', () => ({
  Stack: {
    Screen: ({
      options,
    }: {
      options?: { headerRight?: () => React.ReactNode };
    }) => <div data-testid="stack-screen">{options?.headerRight?.()}</div>,
  },
  useRouter: () => ({
    back: mocks.back,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      card: '#f5f5f5',
      text: '#000',
      textSecondary: '#666',
      textMuted: '#999',
      border: '#ddd',
      primary: '#6200ea',
      textOnPrimary: '#fff',
    },
    shadows: { sm: {} },
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => mocks.useMerchant(),
}));

vi.mock('@/lib/merchant-settings', () => ({
  updateMerchantSettings: mocks.updateMerchantSettings,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
  useMutation: (options: any) => {
    mocks.useMutation(options);
    return {
      mutate: async () => {
        try {
          const data = await options.mutationFn();
          options.onSuccess?.(data);
        } catch (error) {
          options.onError?.(error);
        }
      },
      isPending: false,
    };
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => (
    <div data-testid="screen-skeleton">Skeleton Loading</div>
  ),
}));

vi.mock('@/components/ui/AppKeyboardContainer', () => ({
  AppKeyboardContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="keyboard-container">{children}</div>
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    StatusBar: () => null,
    ActivityIndicator: () => <span>Loading...</span>,
    Alert: {
      alert: mocks.alert,
    },
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
        { onClick: onPress, disabled, type: 'button' },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) => (
      <span>{children}</span>
    ),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel ?? placeholder,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        placeholder,
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      hairlineWidth: 1,
    },
  };
});

describe('SocialMediaScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when merchant data is loading', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: null,
      isLoading: true,
    });

    render(<SocialMediaScreen />);

    expect(screen.getByTestId('screen-skeleton')).toBeInTheDocument();
  });

  it('renders all social media inputs and populates values', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        social_media: {
          instagram: 'baci_insta',
          twitter: 'baci_tweets',
        },
      },
      isLoading: false,
    });

    render(<SocialMediaScreen />);

    expect(screen.getByText('Social Profiles')).toBeInTheDocument();

    const instagramInput = screen.getByLabelText('Instagram Handle');
    const twitterInput = screen.getByLabelText('Twitter/X Handle');
    const facebookInput = screen.getByLabelText('Facebook URL');

    expect(instagramInput).toHaveValue('baci_insta');
    expect(twitterInput).toHaveValue('baci_tweets');
    expect(facebookInput).toHaveValue('');
  });

  it('calls save mutation and handles success flow', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        social_media: {
          instagram: 'old_insta',
        },
      },
      isLoading: false,
    });

    mocks.updateMerchantSettings.mockResolvedValueOnce({});

    render(<SocialMediaScreen />);

    const instagramInput = screen.getByLabelText('Instagram Handle');
    fireEvent.change(instagramInput, { target: { value: 'new_insta' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(mocks.updateMerchantSettings).toHaveBeenCalledWith({
      social_media: expect.objectContaining({
        instagram: 'new_insta',
      }),
    });

    await waitFor(() => {
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['merchant'],
      });
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['store-readiness'],
      });
      expect(mocks.alert).toHaveBeenCalledWith(
        'Success',
        'Social media links updated',
        expect.any(Array)
      );
    });
  });

  it('handles save errors gracefully', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        social_media: {
          instagram: 'insta',
        },
      },
      isLoading: false,
    });

    mocks.updateMerchantSettings.mockRejectedValueOnce(
      new Error('Network Error')
    );

    render(<SocialMediaScreen />);

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith('Error', 'Network Error');
    });
  });
});
