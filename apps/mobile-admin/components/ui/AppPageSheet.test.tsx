import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppPageSheet } from '@/components/ui/AppPageSheet';

const renderState = vi.hoisted(() => ({
  scrollRendered: false,
  staticRendered: false,
}));

function Text({ children }: { children?: React.ReactNode }) {
  return <span>{children}</span>;
}

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
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

vi.mock('react-native', () => {
  return {
    Platform: {
      OS: 'ios',
      select: (objs: Record<string, unknown>) => objs.ios || objs.default,
    },
    KeyboardAvoidingView: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    StatusBar: () => null,
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
      style,
      testID,
    }: {
      children?: React.ReactNode;
      pointerEvents?: string;
      style?: Record<string, unknown> | Record<string, unknown>[];
      testID?: string;
    }) => {
      if (testID === 'app-page-sheet-static') {
        renderState.staticRendered = true;
      }
      const flattenedStyle = Array.isArray(style)
        ? Object.assign({}, ...style)
        : style;

      return (
        <div
          data-height={String(flattenedStyle?.height ?? '')}
          data-testid={testID}
        >
          {children}
        </div>
      );
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
        footer={<Text>Footer action</Text>}
        onClose={vi.fn()}
        title="Receipt Preview"
        visible={true}
      >
        <Text>Preview content</Text>
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

  it('renders floating footer content separately from the solid footer', () => {
    render(
      <AppPageSheet
        floatingFooter={<Text>Floating search</Text>}
        footer={<Text>Solid action</Text>}
        onClose={vi.fn()}
        title="Receipt Preview"
        visible={true}
      >
        <Text>Preview content</Text>
      </AppPageSheet>
    );

    expect(
      screen.getByTestId('app-page-sheet-floating-footer')
    ).toHaveTextContent('Floating search');
    expect(screen.getByText('Solid action')).toBeInTheDocument();
  });

  it('applies custom sheet container sizing', () => {
    render(
      <AppPageSheet
        onClose={vi.fn()}
        sheetContainerStyle={{ height: '92%' }}
        title="Product Picker"
        visible={true}
      >
        <Text>Picker content</Text>
      </AppPageSheet>
    );

    expect(screen.getByTestId('app-page-sheet-container')).toHaveAttribute(
      'data-height',
      '92%'
    );
  });

  it('calls onClose from the shared close action', () => {
    const onClose = vi.fn();

    render(
      <AppPageSheet onClose={onClose} title="Customer Details" visible={true}>
        <Text>Body</Text>
      </AppPageSheet>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close sheet' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop overlay is tapped', () => {
    const onClose = vi.fn();

    render(
      <AppPageSheet onClose={onClose} title="Customer Details" visible={true}>
        <Text>Body</Text>
      </AppPageSheet>
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Close sheet backdrop' })
    );

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
        <Text>Static body</Text>
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
        <Text>Should not appear</Text>
      </AppPageSheet>
    );

    expect(screen.queryByLabelText('page-sheet-modal')).toBeNull();
    expect(screen.queryByText('Should not appear')).toBeNull();
  });
});
