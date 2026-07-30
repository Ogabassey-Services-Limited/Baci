import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SocialMediaScreen from '@/app/(admin)/social-media';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  back: vi.fn(),
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
  useMerchant: vi.fn(),
  updateMerchantSettings: vi.fn(),
  useMutation: vi.fn(),
  invalidateQueries: vi.fn(),
  routeParams: {} as { from?: string },
}));
vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mocks.invalidateStoreReadiness,
}));
type MutationOptions = {
  mutationFn: () => Promise<unknown>;
  onError?: (error: unknown) => void;
  onSuccess?: (data: unknown) => Promise<void> | void;
};
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
      options?: { headerRight?: () => React.ReactNode; title?: string };
    }) => (
      <div data-testid="stack-screen" data-title={options?.title}>
        {options?.headerRight?.()}
      </div>
    ),
  },
  useRouter: () => ({
    back: mocks.back,
  }),
  useLocalSearchParams: () => mocks.routeParams,
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
  useMutation: (options: MutationOptions) => {
    mocks.useMutation(options);
    return {
      mutate: async () => {
        try {
          const data = await options.mutationFn();
          await options.onSuccess?.(data);
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

vi.mock('@/components/ui/ScreenSkeleton', () => {
  // Render the label through a Text-named host so static analysis treats it as a
  // React Native text node; in jsdom it is a plain span, so getByTestId is
  // unaffected.
  const Text = ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  );
  return {
    ScreenSkeleton: () => (
      <div data-testid="screen-skeleton">
        <Text>Skeleton Loading</Text>
      </div>
    ),
  };
});

vi.mock('@/components/ui/AppKeyboardContainer', () => ({
  AppKeyboardContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="keyboard-container">{children}</div>
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  // Text-named host keeps raw labels inside a recognized text node; in jsdom it
  // is a plain span, so rendered text content is unchanged.
  const Text = ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  );
  return {
    StatusBar: () => null,
    ActivityIndicator: () => <Text>Loading...</Text>,
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
    Text,
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
    mocks.alert.mockReset();
    mocks.back.mockReset();
    mocks.invalidateStoreReadiness.mockReset();
    mocks.invalidateStoreReadiness.mockResolvedValue(undefined);
    mocks.invalidateQueries.mockReset();
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.updateMerchantSettings.mockReset();
    mocks.routeParams = {};
    mocks.useMutation.mockReset();
    mocks.useMerchant.mockReset();
    mocks.useMerchant.mockReturnValue({
      merchant: { id: 'merchant-1', social_media: {} },
      isLoading: false,
    });
  });

  it('renders loading skeleton when merchant data is loading', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: null,
      isLoading: true,
    });

    render(<SocialMediaScreen />);

    expect(screen.getByTestId('screen-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('stack-screen')).toHaveAttribute(
      'data-title',
      'Social Media'
    );
  });

  it('renders all social media inputs and populates values', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        id: 'merchant-1',
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

  it('re-seeds form values when merchant social media changes', () => {
    let merchantSocial = {
      instagram: 'initial_insta',
      twitter: 'initial_tweets',
    };
    mocks.useMerchant.mockImplementation(() => ({
      merchant: {
        social_media: merchantSocial,
      },
      isLoading: false,
    }));

    const { rerender } = render(<SocialMediaScreen />);

    expect(screen.getByLabelText('Instagram Handle')).toHaveValue(
      'initial_insta'
    );
    expect(screen.getByLabelText('Twitter/X Handle')).toHaveValue(
      'initial_tweets'
    );

    fireEvent.change(screen.getByLabelText('Instagram Handle'), {
      target: { value: 'draft_insta' },
    });
    expect(screen.getByLabelText('Instagram Handle')).toHaveValue(
      'draft_insta'
    );

    merchantSocial = {
      instagram: 'server_insta',
      twitter: 'server_tweets',
    };
    rerender(<SocialMediaScreen />);

    expect(screen.getByLabelText('Instagram Handle')).toHaveValue(
      'server_insta'
    );
    expect(screen.getByLabelText('Twitter/X Handle')).toHaveValue(
      'server_tweets'
    );
  });

  it('calls save mutation and handles success flow', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        id: 'merchant-1',
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
      expect(mocks.alert).toHaveBeenCalledWith(
        'Success',
        'Social media links updated',
        expect.any(Array)
      );
    });
  });

  it('returns to the checklist without a success alert after a checklist save', async () => {
    mocks.routeParams = { from: 'setup' };
    mocks.useMerchant.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        social_media: { instagram: 'old_insta' },
      },
      isLoading: false,
    });
    mocks.updateMerchantSettings.mockResolvedValueOnce({});

    render(<SocialMediaScreen />);
    fireEvent.change(screen.getByLabelText('Instagram Handle'), {
      target: { value: 'new_insta' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mocks.back).toHaveBeenCalledTimes(1);
    });
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Success',
      expect.any(String),
      expect.any(Array)
    );
  });

  it('waits for merchant and readiness invalidation before presenting success', async () => {
    let releaseReadiness!: () => void;
    const readiness = new Promise<void>((resolve) => {
      releaseReadiness = resolve;
    });
    mocks.invalidateStoreReadiness.mockReturnValueOnce(readiness);
    mocks.useMerchant.mockReturnValue({
      merchant: { id: 'merchant-1', social_media: { instagram: 'old_insta' } },
      isLoading: false,
    });
    mocks.updateMerchantSettings.mockResolvedValueOnce({});

    render(<SocialMediaScreen />);
    fireEvent.change(screen.getByLabelText('Instagram Handle'), {
      target: { value: 'new_insta' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['merchant'],
      });
      expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
        expect.anything(),
        'merchant-1'
      );
    });
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Success',
      expect.any(String),
      expect.any(Array)
    );

    releaseReadiness();

    await waitFor(() => {
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

    // Make the form dirty so Save is enabled (V4 gates Save on a real change).
    fireEvent.change(screen.getByLabelText('Instagram Handle'), {
      target: { value: 'insta_changed' },
    });
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith('Error', 'Network Error');
    });
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('still refreshes merchant data when success settles without merchant context', async () => {
    mocks.useMerchant.mockReturnValue({ merchant: null, isLoading: false });

    render(<SocialMediaScreen />);
    const mutationOptions = mocks.useMutation.mock.calls[0]?.[0] as
      | MutationOptions
      | undefined;

    await expect(mutationOptions?.onSuccess?.({})).resolves.toBeUndefined();
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('preserves save success when only the readiness refresh fails', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: { id: 'merchant-1', social_media: { instagram: 'insta' } },
      isLoading: false,
    });
    mocks.updateMerchantSettings.mockResolvedValueOnce({});
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );

    render(<SocialMediaScreen />);
    fireEvent.change(screen.getByLabelText('Instagram Handle'), {
      target: { value: 'insta_changed' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Success',
        'Social media links updated',
        expect.any(Array)
      );
    });
    expect(mocks.alert).not.toHaveBeenCalledWith('Error', expect.any(String));
  });

  it('preserves save success when merchant invalidation rejects after a successful save', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: { id: 'merchant-1', social_media: { instagram: 'insta' } },
      isLoading: false,
    });
    mocks.updateMerchantSettings.mockResolvedValueOnce({});
    mocks.invalidateQueries.mockRejectedValueOnce(
      new Error('Merchant refresh failed')
    );

    render(<SocialMediaScreen />);
    fireEvent.change(screen.getByLabelText('Instagram Handle'), {
      target: { value: 'insta_changed' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Success',
        'Social media links updated',
        expect.any(Array)
      );
    });
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Error',
      'Merchant refresh failed'
    );
  });

  // ---- V4 drift guards ----
  it('shows a retry state (and no Save) when the merchant load errored', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: null,
      isLoading: false,
      error: new Error('Failed to fetch'),
    });

    render(<SocialMediaScreen />);

    expect(screen.getByText("Couldn't load your settings")).toBeInTheDocument();
    expect(screen.getByTestId('stack-screen')).toHaveAttribute(
      'data-title',
      'Social Media'
    );
    expect(screen.getByText('Retry')).toBeInTheDocument();
    // No Save button can mount, so an empty form can never overwrite saved handles.
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Instagram Handle')).not.toBeInTheDocument();
  });

  it('shows a retry state when settled with no merchant (no wipe)', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: null,
      isLoading: false,
      error: null,
    });

    render(<SocialMediaScreen />);

    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(mocks.updateMerchantSettings).not.toHaveBeenCalled();
  });

  it('keeps the form editable when cached merchant data exists despite a refetch error', () => {
    // TanStack Query keeps the previous `data` while setting `error` on a failed
    // background refetch, so `useMerchant` returns both. The form must stay editable
    // (gated on `!merchant`, not `error`) so a transient refetch failure can't hide
    // the saved handles. (V4 drift guard)
    mocks.useMerchant.mockReturnValue({
      merchant: { social_media: { instagram: 'cached_insta' } },
      isLoading: false,
      error: new Error('Background refetch failed'),
    });

    render(<SocialMediaScreen />);

    // Form is rendered (not the retry state) and seeded from cached data.
    expect(screen.getByLabelText('Instagram Handle')).toHaveValue(
      'cached_insta'
    );
    expect(
      screen.queryByText("Couldn't load your settings")
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    // The Save action remains available so the merchant can still edit.
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('disables Save until a handle actually changes (no no-op write)', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: { social_media: { instagram: 'insta' } },
      isLoading: false,
    });

    render(<SocialMediaScreen />);

    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton as HTMLButtonElement);
    expect(mocks.updateMerchantSettings).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Instagram Handle'), {
      target: { value: 'insta2' },
    });
    expect(screen.getByText('Save').closest('button')).not.toBeDisabled();
  });
});
