import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Hoisted mocks ----

const mocks = vi.hoisted(() => ({
  routerBack: vi.fn(),
  routerPush: vi.fn(),
  alert: vi.fn(),
  supabaseFrom: vi.fn(),
  deleteFn: vi.fn(),
}));

// ---- Module mocks (must be before component import) ----

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Alert: { alert: mocks.alert },
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Pressable: ({
      children,
      onPress,
      disabled,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      React.createElement('button', { onClick: onPress, disabled }, children),
    ScrollView: ({
      children,
    }: {
      children?: React.ReactNode;
      contentContainerStyle?: unknown;
    }) => React.createElement('div', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => React.createElement('span', { style }, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
      multiline?: boolean;
      textAlignVertical?: string;
      placeholderTextColor?: string;
      style?: unknown;
    }) =>
      React.createElement('input', {
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-router', () => ({
  router: { back: mocks.routerBack, push: mocks.routerPush },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }),
}));

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
}));

vi.mock('@/components/ui/InvalidRouteScreen', () => ({
  InvalidRouteScreen: () => null,
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: () => null,
}));

vi.mock('@/constants/theme', () => ({
  RADIUS: { md: 8, lg: 12 },
  SPACING: { sm: 4, md: 8, lg: 16 },
  TYPOGRAPHY: {
    size: { xs: 10, sm: 12, md: 14, lg: 16 },
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semiBold: 'System',
      bold: 'System',
    },
  },
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-abc-123' } }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      text: '#000',
      textSecondary: '#666',
      textMuted: '#999',
      primary: '#0070f3',
      primaryLight: '#e6f0ff',
      card: '#fff',
      border: '#eee',
      error: '#f00',
      errorLight: '#fee',
    },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.supabaseFrom(...args),
    storage: {
      from: () => ({
        upload: vi.fn(),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  },
}));

vi.mock('@/types/upload', () => ({
  asUploadFile: (v: unknown) => v,
}));

// ---- Component import (after all mocks) ----

import BlogPostDetailScreen from '../../../app/(admin)/blog/[id]';

// ---- Helpers ----

function setupSupabaseMocks(deleteResult: { error: unknown }) {
  const eqMerchant = vi.fn().mockResolvedValue(deleteResult);
  const eqId = vi.fn().mockReturnValue({ eq: eqMerchant });
  mocks.deleteFn.mockReturnValue({ eq: eqId });

  const selectSingle = vi.fn().mockResolvedValue({
    data: {
      title: 'Test Post',
      excerpt: 'Excerpt',
      category: 'Tech',
      featured_image_url: '',
      status: 'draft',
    },
    error: null,
  });

  const selectEqMerchant = vi.fn().mockReturnValue({ single: selectSingle });
  const selectEqId = vi.fn().mockReturnValue({ eq: selectEqMerchant });
  const selectMock = vi.fn().mockReturnValue({ eq: selectEqId });

  mocks.supabaseFrom.mockReturnValue({
    select: selectMock,
    delete: mocks.deleteFn,
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  });

  return { eqId, eqMerchant };
}

type AlertButton = { text: string; onPress?: () => Promise<void> };

function getDeleteConfirmButton(): AlertButton | undefined {
  const alertButtons = mocks.alert.mock.calls[0][2] as AlertButton[];
  return alertButtons.find((b) => b.text === 'Delete');
}

// ---- Tests ----

describe('BlogPostDetailScreen - Delete handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('scopes delete query to merchant_id for tenant isolation', async () => {
    const { eqId, eqMerchant } = setupSupabaseMocks({ error: null });

    await act(async () => {
      render(<BlogPostDetailScreen />);
    });

    // Wait for the component to finish loading (fetchPost resolves)
    await waitFor(() => {
      expect(screen.getByText('Delete Post')).toBeTruthy();
    });

    // Click the Delete Post button to trigger handleDelete -> Alert.alert
    const deleteButton = screen.getByText('Delete Post');
    fireEvent.click(deleteButton);

    // Alert.alert is called with confirmation dialog
    expect(mocks.alert).toHaveBeenCalledWith(
      'Delete Post',
      'Are you sure?',
      expect.any(Array)
    );

    // Simulate pressing 'Delete' in the confirmation dialog
    const deleteConfirm = getDeleteConfirmButton();
    expect(deleteConfirm).toBeDefined();

    await act(async () => {
      await deleteConfirm?.onPress?.();
    });

    // Verify supabase.from('blog_posts').delete() was called
    expect(mocks.supabaseFrom).toHaveBeenCalledWith('blog_posts');
    expect(mocks.deleteFn).toHaveBeenCalled();

    // Verify .eq('id', ...) and .eq('merchant_id', ...) were chained
    expect(eqId).toHaveBeenCalledWith(
      'id',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    );
    expect(eqMerchant).toHaveBeenCalledWith('merchant_id', 'merchant-abc-123');

    // On success, router.back() is called
    expect(mocks.routerBack).toHaveBeenCalled();
  });

  it('shows error alert and does not navigate on delete failure', async () => {
    const supabaseError = { message: 'RLS policy violation', code: '42501' };
    setupSupabaseMocks({ error: supabaseError });

    await act(async () => {
      render(<BlogPostDetailScreen />);
    });

    // Wait for the component to finish loading
    await waitFor(() => {
      expect(screen.getByText('Delete Post')).toBeTruthy();
    });

    // Click the Delete Post button
    const deleteButton = screen.getByText('Delete Post');
    fireEvent.click(deleteButton);

    // Simulate pressing 'Delete' in the confirmation dialog
    const deleteConfirm = getDeleteConfirmButton();

    // Reset mocks to track only the error alert
    mocks.alert.mockClear();
    mocks.routerBack.mockClear();

    await act(async () => {
      await deleteConfirm?.onPress?.();
    });

    // Error alert shown with safe message (no leaking implementation details)
    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to delete blog post. Please try again.'
    );

    // router.back() should NOT be called on error
    expect(mocks.routerBack).not.toHaveBeenCalled();
  });
});
