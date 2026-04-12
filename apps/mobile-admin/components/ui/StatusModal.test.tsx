import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StatusModal,
  type StatusModalState,
} from '@/components/ui/StatusModal';

const dialogState = vi.hoisted(() => ({
  visible: false,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
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
      <section aria-label="status-dialog">{children}</section>
    ) : null;
  },
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      card: '#111827',
      error: '#ef4444',
      errorLight: '#fee2e2',
      primary: '#3b82f6',
      success: '#10b981',
      successLight: '#d1fae5',
      text: '#f9fafb',
      textSecondary: '#cbd5e1',
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

describe('StatusModal', () => {
  const successStatus: StatusModalState = {
    visible: true,
    type: 'success',
    title: 'Saved',
    message: 'Store settings were updated.',
  };
  const errorStatus: StatusModalState = {
    visible: true,
    type: 'error',
    title: 'Error',
    message: 'Something went wrong.',
  };

  beforeEach(() => {
    dialogState.visible = false;
  });

  it('renders the success status content when visible', () => {
    render(<StatusModal onClose={vi.fn()} status={successStatus} />);

    expect(dialogState.visible).toBe(true);
    expect(screen.getByLabelText('status-dialog')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(
      screen.getByText('Store settings were updated.')
    ).toBeInTheDocument();
    expect(screen.getByText('checkmark')).toBeInTheDocument();
  });

  it('invokes onClose from the dismiss action', () => {
    const onClose = vi.fn();

    render(<StatusModal onClose={onClose} status={successStatus} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss status message' })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the error status content when visible', () => {
    render(<StatusModal onClose={vi.fn()} status={errorStatus} />);

    expect(dialogState.visible).toBe(true);
    expect(screen.getByLabelText('status-dialog')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByText('alert')).toBeInTheDocument();
  });

  it('does not render content when hidden', () => {
    render(
      <StatusModal
        onClose={vi.fn()}
        status={{ ...successStatus, visible: false, type: 'error' }}
      />
    );

    expect(dialogState.visible).toBe(false);
    expect(screen.queryByLabelText('status-dialog')).toBeNull();
    expect(screen.queryByText('Saved')).toBeNull();
  });
});
