import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SuccessModal } from '@/components/ui/SuccessModal';

const dialogState = vi.hoisted(() => ({
  visible: false,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('react-native-reanimated', () => ({
  default: {
    View: ({
      children,
    }: {
      children?: ReactNode;
      accessibilityLabel?: string;
    }) => <section aria-label="animated-success-view">{children}</section>,
  },
  FadeInUp: {
    springify: () => ({
      damping: () => ({}),
    }),
  },
}));

vi.mock('@/components/ui/AppDialogModal', () => ({
  AppDialogModal: ({
    children,
    visible,
  }: {
    children?: ReactNode;
    visible: boolean;
  }) => {
    dialogState.visible = visible;
    return visible ? (
      <section aria-label="success-dialog">{children}</section>
    ) : null;
  },
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      backgroundLight: '#f8fafc',
      border: '#e2e8f0',
      card: '#ffffff',
      primary: '#3b82f6',
      success: '#10b981',
      successLight: '#d1fae5',
      text: '#0f172a',
      textMuted: '#64748b',
      textSecondary: '#475569',
    },
  }),
}));

vi.mock('react-native', () => {
  return {
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
  };
});

describe('SuccessModal', () => {
  it('renders the success content and optional follow-up action', () => {
    render(
      <SuccessModal
        actionIcon="logo-whatsapp"
        actionLabel="Send to rider"
        message="Order details were sent successfully."
        onActionPress={vi.fn()}
        onClose={vi.fn()}
        subMessage="The rider will receive a WhatsApp message."
        visible={true}
      />
    );

    expect(dialogState.visible).toBe(true);
    expect(screen.getByLabelText('success-dialog')).toBeInTheDocument();
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(
      screen.getByText('Order details were sent successfully.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('The rider will receive a WhatsApp message.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Send to rider' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('invokes the primary and secondary actions', () => {
    const onActionPress = vi.fn();
    const onClose = vi.fn();

    render(
      <SuccessModal
        actionLabel="Share receipt"
        message="Receipt is ready."
        onActionPress={onActionPress}
        onClose={onClose}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share receipt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onActionPress).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render content when hidden', () => {
    render(
      <SuccessModal message="Hidden modal" onClose={vi.fn()} visible={false} />
    );

    expect(dialogState.visible).toBe(false);
    expect(screen.queryByLabelText('success-dialog')).toBeNull();
    expect(screen.queryByText('Hidden modal')).toBeNull();
  });
});
