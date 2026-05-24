import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ReceiptPreviewModal } from '@/components/ui/ReceiptPreviewModal';

const pageSheetState = vi.hoisted(() => ({
  footer: null as ReactNode,
}));

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    closeLabel,
    footer,
    onClose,
    title,
    visible,
  }: {
    children?: ReactNode;
    closeLabel?: string;
    footer?: ReactNode;
    onClose: () => void;
    title: string;
    visible: boolean;
  }) => {
    pageSheetState.footer = footer ?? null;

    return visible ? (
      <section aria-label="receipt-page-sheet">
        <button
          aria-label={closeLabel ?? 'Close sheet'}
          onClick={onClose}
          type="button"
        >
          close
        </button>
        <h1>{title}</h1>
        <div>{children}</div>
        <div>{footer}</div>
      </section>
    ) : null;
  },
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      primary: '#2563eb',
    },
  }),
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native-webview', () => ({
  default: ({ source }: { source: { html: string } }) => (
    <section aria-label="receipt-webview">{source.html}</section>
  ),
}));

vi.mock('react-native', async () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('ReceiptPreviewModal', () => {
  it('does not render when hidden', () => {
    pageSheetState.footer = null;

    render(
      <ReceiptPreviewModal
        html="<p>Receipt HTML</p>"
        isPaid={true}
        onClose={vi.fn()}
        onShare={vi.fn()}
        visible={false}
      />
    );

    expect(
      screen.queryByLabelText('receipt-page-sheet')
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('receipt-webview')).not.toBeInTheDocument();
    expect(screen.queryByText('Receipt Preview')).not.toBeInTheDocument();
  });

  it('renders through the shared page-sheet shell', () => {
    render(
      <ReceiptPreviewModal
        html="<p>Receipt HTML</p>"
        isPaid={true}
        onClose={vi.fn()}
        onShare={vi.fn()}
        visible={true}
      />
    );

    expect(screen.getByLabelText('receipt-page-sheet')).toBeInTheDocument();
    expect(screen.getByText('Receipt Preview')).toBeInTheDocument();
    expect(screen.getByLabelText('receipt-webview')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Share as PDF' })
    ).toBeInTheDocument();
    expect(pageSheetState.footer).toBeTruthy();
  });

  it('routes close and share actions', () => {
    const onClose = vi.fn();
    const onShare = vi.fn();

    render(
      <ReceiptPreviewModal
        html="<p>Invoice HTML</p>"
        isPaid={false}
        onClose={onClose}
        onShare={onShare}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share as PDF' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Invoice Preview')).toBeInTheDocument();
  });
});
