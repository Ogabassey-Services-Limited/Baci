import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  errorMessage: null as string | null,
  handleSave: vi.fn(),
  openAIModal: vi.fn(),
  retryLoad: vi.fn(),
}));

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import(
    '../auth/app-form-screen.mock'
  );
  return createAppFormScreenMock();
});

vi.mock('@/components/blog-editor/BlogEditorDialogs', () => ({
  BlogEditorDialogs: () => <section aria-label="blog-editor-dialogs" />,
}));

vi.mock('@/components/blog-editor/BlogEditorToolbar', () => ({
  BlogEditorToolbar: () => <section aria-label="blog-editor-toolbar" />,
}));

vi.mock('@/hooks/useBlogEditor', () => ({
  useBlogEditor: () => ({
    aiInstruction: '',
    content: '<p>Hello</p>',
    closeAIModal: vi.fn(),
    closeLinkModal: vi.fn(),
    errorMessage: mocks.errorMessage,
    formatAction: vi.fn(),
    handleImagePick: vi.fn(),
    handleInsertLink: vi.fn(),
    handleInsertTable: vi.fn(),
    handleInsertVideo: vi.fn(),
    handleSave: mocks.handleSave,
    isAIModalVisible: false,
    isAIProcessing: false,
    isLinkModalVisible: false,
    isLoading: false,
    isSaving: false,
    isUploadingImage: false,
    initialEditorContent: '<p>Hello</p>',
    linkUrl: '',
    onWebViewMessage: vi.fn(),
    openAIModal: mocks.openAIModal,
    openLinkModal: vi.fn(),
    requestAIEdit: vi.fn(),
    retryLoad: mocks.retryLoad,
    setAiInstruction: vi.fn(),
    setLinkUrl: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      primary: '#3b82f6',
      text: '#f8fafc',
      textOnPrimary: '#ffffff',
    },
  }),
}));

vi.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    back: vi.fn(),
  },
  useLocalSearchParams: () => ({
    id: 'post-1',
  }),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: {
    prompt: vi.fn(),
  },
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    absoluteFillObject: { position: 'absolute', inset: 0 },
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-native-webview', () => ({
  WebView: () => <iframe title="blog-editor-webview" />,
}));

import EditContentScreen from '@/app/(admin)/blog/edit-content';
import { APP_KEYBOARD_CONTAINER_LABEL } from '../auth/app-keyboard-container.mock';

describe('EditContentScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.errorMessage = null;
  });

  it('renders inside the shared form shell with the editor toolbar', () => {
    render(<EditContentScreen />);

    expect(
      screen.getByRole('region', { name: APP_KEYBOARD_CONTAINER_LABEL })
    ).toBeInTheDocument();
    expect(screen.getByText('Edit Content')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'blog-editor-toolbar' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'blog-editor-dialogs' })
    ).toBeInTheDocument();
  });

  it('forwards header and AI button actions', () => {
    render(<EditContentScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Save content' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open AI editor' }));

    expect(mocks.handleSave).toHaveBeenCalledTimes(1);
    expect(mocks.openAIModal).toHaveBeenCalledTimes(1);
  });

  it('renders a retry state when the editor fails to load', () => {
    mocks.errorMessage = 'Missing blog post id';

    render(<EditContentScreen />);

    expect(screen.getByText('Unable to load editor')).toBeInTheDocument();
    expect(screen.getByText('Missing blog post id')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading editor' })
    );

    expect(mocks.retryLoad).toHaveBeenCalledTimes(1);
  });
});
