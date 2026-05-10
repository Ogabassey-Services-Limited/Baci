import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BuilderClient from './builder-client';

const mockPush = vi.fn();
const mockToast = vi.fn();
const { mockApiPost, mockApiPut, mockFetchWithCsrf } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockFetchWithCsrf: vi.fn(),
}));

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

vi.mock('@/lib/api-client', () => ({
  apiPost: mockApiPost,
  apiPut: mockApiPut,
  fetchWithCsrf: mockFetchWithCsrf,
}));

vi.mock('@/lib/theme-manager', () => ({
  applyTheme: vi.fn(),
}));

describe('BuilderClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/builder');
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
        previewMode: null,
        aiDraftJobId: null,
        canApplyAiDraft: false,
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
        previewMode: null,
        aiDraftJobId: null,
        canApplyAiDraft: true,
      }),
    } as Response);

    render(<BuilderClient />);

    const saveButton = await screen.findByRole('button', {
      name: /save draft/i,
    });

    expect(
      screen.queryByText('Builder is in read-only mode')
    ).not.toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /publish/i })).not.toBeDisabled();
  });

  it('includes the AI draft job id from the URL when bootstrapping', async () => {
    const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';
    window.history.pushState({}, '', `/builder?aiDraftJobId=${aiDraftJobId}`);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        config: {
          content: [],
          root: { title: 'AI Home' },
          zones: {},
        },
        seo: null,
        storeSettings: null,
        setupSettings: null,
        publishedConfig: null,
        isPublished: false,
        isDefault: false,
        lastUpdated: '2026-04-28T10:00:00.000Z',
        degraded: false,
        degradedReason: null,
        canEdit: false,
        previewMode: 'ai_draft',
        aiDraftJobId,
        canApplyAiDraft: false,
      }),
    } as Response);

    render(<BuilderClient />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`aiDraftJobId=${aiDraftJobId}`)
      );
    });
  });

  it('renders AI draft previews without apply controls for view-only staff', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        config: {
          content: [],
          root: { title: 'AI Home' },
          zones: {},
        },
        seo: null,
        storeSettings: null,
        setupSettings: null,
        publishedConfig: null,
        isPublished: false,
        isDefault: false,
        lastUpdated: '2026-04-28T10:00:00.000Z',
        degraded: false,
        degradedReason: null,
        canEdit: false,
        previewMode: 'ai_draft',
        aiDraftJobId: '5c0a0676-bd3f-495e-9f98-589f208c0d79',
        canApplyAiDraft: false,
      }),
    } as Response);

    render(<BuilderClient />);

    await waitFor(() => {
      expect(screen.getAllByText(/AI draft preview/i).length).toBeGreaterThan(
        0
      );
    });

    expect(
      screen.queryByRole('button', { name: /apply ai design/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /save draft/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /publish/i })
    ).not.toBeInTheDocument();
  });

  it('applies AI draft previews for users with builder edit access', async () => {
    const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        config: {
          content: [],
          root: { title: 'AI Home' },
          zones: {},
        },
        seo: null,
        storeSettings: null,
        setupSettings: null,
        publishedConfig: null,
        isPublished: false,
        isDefault: false,
        lastUpdated: '2026-04-28T10:00:00.000Z',
        degraded: false,
        degradedReason: null,
        canEdit: false,
        previewMode: 'ai_draft',
        aiDraftJobId,
        canApplyAiDraft: true,
      }),
    } as Response);
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        lastUpdated: '2026-04-28T10:10:00.000Z',
      }),
    } as Response);

    render(<BuilderClient />);

    const applyButton = await screen.findByRole('button', {
      name: /apply ai design/i,
    });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `/api/ai-jobs/${aiDraftJobId}/apply`,
        expect.objectContaining({
          method: 'POST',
          body: '{}',
        })
      );
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI design applied' })
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled();
      expect(
        screen.queryByRole('button', { name: /apply ai design/i })
      ).not.toBeInTheDocument();
    });
    expect(mockPush).toHaveBeenCalledWith('/builder');
  });

  it('confirms before force-applying a stale AI draft preview', async () => {
    const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        config: {
          content: [],
          root: { title: 'AI Home' },
          zones: {},
        },
        seo: null,
        storeSettings: null,
        setupSettings: null,
        publishedConfig: null,
        isPublished: false,
        isDefault: false,
        lastUpdated: '2026-04-28T10:00:00.000Z',
        degraded: false,
        degradedReason: null,
        canEdit: false,
        previewMode: 'ai_draft',
        aiDraftJobId,
        canApplyAiDraft: true,
      }),
    } as Response);
    mockFetchWithCsrf
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ code: 'ai_draft_stale' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          lastUpdated: '2026-04-28T10:10:00.000Z',
        }),
      } as Response);

    render(<BuilderClient />);

    const applyButton = await screen.findByRole('button', {
      name: /apply ai design/i,
    });
    fireEvent.click(applyButton);

    const dialog = await screen.findByRole('alertdialog', {
      name: /replace your current draft/i,
    });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /replace draft/i }));

    await waitFor(() => {
      expect(mockFetchWithCsrf).toHaveBeenCalledTimes(2);
    });
    expect(mockFetchWithCsrf).toHaveBeenLastCalledWith(
      `/api/ai-jobs/${aiDraftJobId}/apply`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ force: true }),
      })
    );
  });
});
