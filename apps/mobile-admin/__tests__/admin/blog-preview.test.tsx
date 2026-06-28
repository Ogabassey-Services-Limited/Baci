import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  routerBack: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { 'aria-label': accessibilityLabel, onClick: onPress, type: 'button' },
        children
      ),
    ScrollView: ({
      children,
    }: {
      children?: React.ReactNode;
      contentContainerStyle?: unknown;
    }) => React.createElement('div', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
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
  router: { back: mocks.routerBack },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  }),
}));

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const React = await import('react');
  return {
    default: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('@/components/ui/InvalidRouteScreen', () => ({
  InvalidRouteScreen: () => null,
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: ({
    accessibilityLabel,
    source,
  }: {
    accessibilityLabel?: string;
    source?: { uri?: string };
  }) => <img alt={accessibilityLabel} src={source?.uri} />,
}));

vi.mock('react-native-webview', () => ({
  WebView: ({ source }: { source?: { html?: string } }) => (
    <iframe
      data-source-html={source?.html ?? ''}
      sandbox=""
      title="article-preview"
    />
  ),
}));

vi.mock('@/constants/theme', () => ({
  RADIUS: { md: 8, lg: 12, xl: 16 },
  SPACING: { xs: 2, sm: 4, md: 8, lg: 16, xl: 20, '2xl': 24 },
  TYPOGRAPHY: {
    size: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, '2xl': 24 },
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
      card: '#fff',
      border: '#eee',
      warning: '#b45309',
      warningLight: '#fef3c7',
    },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.supabaseFrom(...args),
  },
}));

import BlogPreviewScreen from '@/app/(admin)/blog/preview';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function setupPreviewFetch() {
  const single = vi.fn().mockResolvedValue({
    data: {
      title:
        'Google I/O 2026 puts Android AI first: what Nigerian buyers should watch',
      excerpt: 'Android AI buying guide for Nigerian customers.',
      category: 'Tech News',
      content: '<p>Gemini is moving deeper into Android.</p>',
      featured_image_url: 'https://cdn.example.com/android-ai.webp',
      published_at: '2026-05-25T08:00:00.000Z',
      status: 'draft',
      updated_at: '2026-05-25T09:00:00.000Z',
    },
    error: null,
  });
  const eqMerchant = vi.fn().mockReturnValue({ single });
  const eqId = vi.fn().mockReturnValue({ eq: eqMerchant });
  const select = vi.fn().mockReturnValue({ eq: eqId });

  mocks.supabaseFrom.mockReturnValue({ select });

  return { eqId, eqMerchant, select };
}

describe('BlogPreviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a merchant-scoped mobile article preview with the featured image', async () => {
    const { eqId, eqMerchant, select } = setupPreviewFetch();

    const queryClient = createTestQueryClient();

    act(() => {
      render(
        <QueryClientProvider client={queryClient}>
          <BlogPreviewScreen />
        </QueryClientProvider>
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Google I\/O 2026 puts Android AI first/i)
      ).toBeInTheDocument();
    });

    expect(mocks.supabaseFrom).toHaveBeenCalledWith('blog_posts');
    expect(select).toHaveBeenCalledWith(
      'title, excerpt, category, content, featured_image_url, status, published_at, updated_at'
    );
    expect(eqId).toHaveBeenCalledWith(
      'id',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    );
    expect(eqMerchant).toHaveBeenCalledWith('merchant_id', 'merchant-abc-123');
    expect(
      screen.getByRole('img', { name: 'Featured image preview' })
    ).toHaveAttribute('src', 'https://cdn.example.com/android-ai.webp');
    expect(screen.getByTitle('article-preview')).toHaveAttribute(
      'data-source-html',
      expect.stringContaining('Gemini is moving deeper into Android.')
    );
    expect(screen.getByTitle('article-preview')).toHaveAttribute('sandbox', '');
    expect(screen.getByText('Draft preview')).toBeInTheDocument();
  });
});
