import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppPageSheet } from '@/components/ui/AppPageSheet';

const renderState = vi.hoisted(() => ({
  scrollRendered: false,
  staticRendered: false,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#f8fafc',
      backgroundLight: '#ffffff',
      border: '#e2e8f0',
      card: '#ffffff',
      text: '#0f172a',
    },
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 8, right: 0, bottom: 12, left: 0 }),
}));

vi.mock('react-native', async () => {
  return {
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible?: boolean;
    }) =>
      visible ? (
        <section aria-label="page-sheet-modal">{children}</section>
      ) : null,
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) => (
      <button aria-label={accessibilityLabel} onClick={onPress} type="button">
        {children}
      </button>
    ),
    ScrollView: ({ children }: { children?: React.ReactNode }) => {
      renderState.scrollRendered = true;
      return <section aria-label="page-sheet-scroll-view">{children}</section>;
    },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
    Text: ({ children }: { children?: React.ReactNode }) => (
      <span>{children}</span>
    ),
    View: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => {
      if (testID === 'app-page-sheet-static') {
        renderState.staticRendered = true;
      }
      return <div>{children}</div>;
    },
  };
});

describe('AppPageSheet', () => {
  beforeEach(() => {
    renderState.scrollRendered = false;
    renderState.staticRendered = false;
  });

  it('renders the shared page-sheet header, content, and footer', () => {
    render(
      <AppPageSheet
        footer={<div>Footer action</div>}
        onClose={vi.fn()}
        title="Receipt Preview"
        visible={true}
      >
        <div>Preview content</div>
      </AppPageSheet>
    );

    expect(screen.getByLabelText('page-sheet-modal')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close sheet' })
    ).toBeInTheDocument();
    expect(screen.getByText('Receipt Preview')).toBeInTheDocument();
    expect(screen.getByText('Preview content')).toBeInTheDocument();
    expect(screen.getByText('Footer action')).toBeInTheDocument();
    expect(renderState.scrollRendered).toBe(true);
  });

  it('calls onClose from the shared close action', () => {
    const onClose = vi.fn();

    render(
      <AppPageSheet onClose={onClose} title="Customer Details" visible={true}>
        <div>Body</div>
      </AppPageSheet>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close sheet' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders static content when scrolling is disabled', () => {
    render(
      <AppPageSheet
        onClose={vi.fn()}
        scrollEnabled={false}
        title="Static Sheet"
        visible={true}
      >
        <div>Static body</div>
      </AppPageSheet>
    );

    expect(
      screen.queryByRole('region', { name: 'page-sheet-scroll-view' })
    ).toBeNull();
    expect(renderState.staticRendered).toBe(true);
    expect(screen.getByText('Static body')).toBeInTheDocument();
  });

  it('does not render content when not visible', () => {
    render(
      <AppPageSheet onClose={vi.fn()} title="Hidden Sheet" visible={false}>
        <div>Should not appear</div>
      </AppPageSheet>
    );

    expect(screen.queryByLabelText('page-sheet-modal')).toBeNull();
    expect(screen.queryByText('Should not appear')).toBeNull();
  });
});
