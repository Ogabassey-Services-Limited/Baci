import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';

const hoistedBuilderClientTestMocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  defaultSettingsFactory: vi.fn(),
  fetchWithCsrf: vi.fn(),
  merchant: { id: 'merchant-1', slug: 'test-store' },
  push: vi.fn(),
  toast: vi.fn(),
}));

export const builderClientTestMocks = hoistedBuilderClientTestMocks;

const mockRouter = { push: builderClientTestMocks.push };

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
  useRouter: () => mockRouter,
}));

vi.mock('@puckeditor/core/puck.css', () => ({}));

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

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    merchant: builderClientTestMocks.merchant,
    loading: false,
  }),
}));

vi.mock('@/hooks/use-cart', () => ({
  CartProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="cart-provider">{children}</div>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: builderClientTestMocks.toast,
  }),
}));

vi.mock('@/lib/api-client', () => ({
  apiPost: builderClientTestMocks.apiPost,
  apiPut: builderClientTestMocks.apiPut,
  fetchWithCsrf: builderClientTestMocks.fetchWithCsrf,
}));

vi.mock('@/lib/theme-manager', () => ({
  applyTheme: vi.fn(),
}));

vi.mock('./builder-default-settings', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./builder-default-settings')>();
  return {
    ...actual,
    createDefaultBuilderSettings: () => {
      builderClientTestMocks.defaultSettingsFactory();
      return actual.createDefaultBuilderSettings();
    },
  };
});

export function createBuilderPayload(
  overrides: Partial<{
    aiDraftJobId: string | null;
    canApplyAiDraft: boolean;
    canEdit: boolean;
    config: { content: unknown[]; root: { title: string }; zones: object };
    degraded: boolean;
    degradedReason: 'config_load_failed' | null;
    isDefault: boolean;
    lastUpdated: string | null;
    previewMode: 'ai_draft' | null;
  }> = {}
) {
  return {
    config: { content: [], root: { title: 'Home' }, zones: {} },
    seo: null,
    storeSettings: null,
    setupSettings: null,
    publishedConfig: null,
    isPublished: false,
    isDefault: true,
    lastUpdated: null,
    degraded: true,
    degradedReason: 'config_load_failed' as const,
    canEdit: false,
    previewMode: null,
    aiDraftJobId: null,
    canApplyAiDraft: false,
    ...overrides,
  };
}

export function mockBuilderBootstrap(payload = createBuilderPayload()) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => payload,
  } as Response);
}

export function resetBuilderClientTest() {
  vi.clearAllMocks();
  builderClientTestMocks.merchant = { id: 'merchant-1', slug: 'test-store' };
  window.history.pushState({}, '', '/builder');
  mockBuilderBootstrap();
}

export function setBuilderClientMerchant(id: string, slug = 'test-store') {
  builderClientTestMocks.merchant = { id, slug };
}

export function cleanupBuilderClientTest() {
  cleanup();
  vi.restoreAllMocks();
}
