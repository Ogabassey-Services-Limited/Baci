import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BuilderClient from './builder-client';

const mockPush = vi.fn();
const mockToast = vi.fn();

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@puckeditor/core', () => {
  const PuckComponent = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="puck">{children}</div>
  );

  Object.assign(PuckComponent, {
    Outline: () => <div data-testid="puck-outline" />,
    Components: () => <div data-testid="puck-components" />,
    Preview: () => <div data-testid="puck-preview" />,
    Fields: () => <div data-testid="puck-fields" />,
  });

  return {
    Puck: PuckComponent,
    Drawer: {
      Item: ({
        children,
      }: {
        children: (args: { children: null }) => React.ReactNode;
      }) => <div>{children({ children: null })}</div>,
    },
  };
});

vi.mock('@/components/builder/builder-sidebar', () => ({
  BuilderSidebar: ({
    children,
    aiTools,
  }: {
    children: React.ReactNode;
    aiTools?: React.ReactNode;
  }) => (
    <div data-testid="builder-sidebar">
      {aiTools}
      {children}
    </div>
  ),
}));

vi.mock('@/components/builder/inline-context-menu', () => ({
  InlineContextMenu: () => <div data-testid="inline-context-menu" />,
}));

vi.mock('@/components/builder/media-library', () => ({
  MediaLibrary: () => <div data-testid="media-library" />,
}));

vi.mock('@/components/builder/seo-panel', () => ({
  SEOPanel: () => <div data-testid="seo-panel" />,
}));

vi.mock('@/components/builder/setup-panel', () => ({
  SetupPanel: () => <div data-testid="setup-panel" />,
}));

vi.mock('@/components/builder/store-settings-panel', () => ({
  StoreSettingsPanel: () => <div data-testid="store-settings-panel" />,
}));

vi.mock('@/components/builder/theme-editor-redesigned', () => ({
  ThemeEditor: () => <div data-testid="theme-editor" />,
}));

vi.mock('@/components/builder/use-copilot-builder-actions', () => ({
  useCopilotBuilderActions: () => undefined,
}));

vi.mock('@/components/builder/gemini-command-bar', () => ({
  GeminiCommandBar: ({ disabled }: { disabled?: boolean }) => (
    <div
      data-testid="gemini-command-bar"
      data-disabled={disabled ? 'true' : 'false'}
    />
  ),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    loading: false,
  }),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: () => ({
    merchant: { id: 'merchant-1', slug: 'test-store' },
    loading: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/lib/theme-manager', () => ({
  applyTheme: vi.fn(),
}));

describe('BuilderClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        config: {
          content: [],
          root: { title: 'Home' },
          zones: {},
        },
        seo: null,
        storeSettings: null,
        setupSettings: null,
        publishedConfig: null,
        isPublished: false,
        isDefault: true,
        lastUpdated: null,
        degraded: true,
        degradedReason: 'config_load_failed',
        canEdit: false,
      }),
    } as Response);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the builder in read-only recovery mode when the payload is degraded', async () => {
    render(<BuilderClient />);

    await waitFor(() => {
      expect(
        screen.getByText('Builder is in read-only mode')
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled();
    // The builder renders GeminiCommandBar once in the header and once in the sidebar tools panel.
    expect(screen.getAllByTestId('gemini-command-bar')).toHaveLength(2);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Builder opened in read-only mode',
      })
    );
  });

  it('renders the builder in editable mode when the payload is healthy', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        config: {
          content: [],
          root: { title: 'Home' },
          zones: {},
        },
        seo: null,
        storeSettings: null,
        setupSettings: null,
        publishedConfig: null,
        isPublished: false,
        isDefault: true,
        lastUpdated: '2026-03-20T18:00:00.000Z',
        degraded: false,
        degradedReason: null,
        canEdit: true,
      }),
    } as Response);

    render(<BuilderClient />);

    await waitFor(() => {
      expect(
        screen.queryByText('Builder is in read-only mode')
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /save draft/i })
    ).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /publish/i })).not.toBeDisabled();
  });
});
