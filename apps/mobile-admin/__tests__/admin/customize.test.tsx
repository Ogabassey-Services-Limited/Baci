import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  back: vi.fn(),
  config: { root: { title: 'Store' } },
  messages: [] as never[],
  publish: vi.fn(),
  saveDraft: vi.fn(),
}));

vi.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => ReactNode } }) => (
      <>{options?.headerRight?.()}</>
    ),
  },
  useRouter: () => ({
    back: mocks.back,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      card: '#111827',
      primary: '#3b82f6',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textSecondary: '#94a3b8',
    },
    shadows: {
      md: {},
    },
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    storeUrl: 'store.usebaci.com',
  }),
}));

vi.mock('@/hooks/useBuilderConfig', () => ({
  useBuilderConfig: () => ({
    config: mocks.config,
    configError: null,
    hasUnsavedChanges: true,
    isLoadingConfig: false,
    isProcessingAI: false,
    isPublishing: false,
    isSavingDraft: false,
    messages: mocks.messages,
    publish: mocks.publish,
    saveDraft: mocks.saveDraft,
    sendMessage: vi.fn(),
  }),
}));

vi.mock('@/components/customize/CustomizeChatPanel', () => ({
  CustomizeChatPanel: () => (
    <section aria-label="customize-chat-panel">Chat panel</section>
  ),
}));

vi.mock('@/components/customize/CustomizePreviewPane', () => ({
  CustomizePreviewPane: ({ previewUrl }: { previewUrl: string }) => (
    <section aria-label="customize-preview-pane">{previewUrl}</section>
  ),
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => <div>loading skeleton</div>,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: {
    alert: mocks.alert,
  },
  FlatList: () => null,
  Pressable: ({
    children,
    disabled,
    onPress,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button disabled={disabled} onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  StyleSheet: {
    absoluteFillObject: { position: 'absolute', inset: 0 },
    create: (styles: Record<string, unknown>) => styles,
  },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import CustomizeScreen from '@/app/(admin)/customize';

describe('CustomizeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the chat view by default and forwards save actions', () => {
    render(<CustomizeScreen />);

    expect(
      screen.getByRole('region', { name: 'customize-chat-panel' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save'));

    expect(mocks.saveDraft).toHaveBeenCalledTimes(1);
    expect(mocks.saveDraft).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );
  });

  it('surfaces save draft errors through the alert handler', () => {
    mocks.saveDraft.mockImplementationOnce(
      (_: unknown, callbacks?: unknown) => {
        if (
          callbacks &&
          typeof callbacks === 'object' &&
          'onError' in callbacks &&
          typeof callbacks.onError === 'function'
        ) {
          callbacks.onError(new Error('Save failed'));
        }
      }
    );

    render(<CustomizeScreen />);

    fireEvent.click(screen.getByText('Save'));

    expect(mocks.alert).toHaveBeenCalledWith('Error', 'Save failed');
  });

  it('switches to the preview pane', () => {
    render(<CustomizeScreen />);

    fireEvent.click(screen.getByText('Preview'));

    expect(
      screen.getByRole('region', { name: 'customize-preview-pane' })
    ).toHaveTextContent('https://store.usebaci.com?preview=true&t=');
  });
});
