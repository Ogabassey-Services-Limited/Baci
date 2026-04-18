import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppDialogModal } from '@/components/ui/AppDialogModal';

vi.mock('@/components/ui/AppKeyboardContainer', () => ({
  AppKeyboardContainer: ({ children }: { children?: ReactNode }) => (
    <section aria-label="dialog-keyboard-shell">{children}</section>
  ),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      backdrop: 'rgba(0, 0, 0, 0.55)',
    },
  }),
}));

vi.mock('react-native', () => {
  return {
    Modal: ({
      children,
      visible,
    }: {
      children?: ReactNode;
      visible?: boolean;
    }) =>
      visible ? <section aria-label="dialog-modal">{children}</section> : null,
    Pressable: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID} onClick={onPress} type="button">
        {children}
      </button>
    ),
    StyleSheet: {
      absoluteFillObject: { position: 'absolute', inset: 0 },
      create: (styles: Record<string, unknown>) => styles,
    },
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

describe('AppDialogModal', () => {
  it('renders children inside the shared dialog shell when visible', () => {
    render(
      <AppDialogModal onClose={vi.fn()} visible={true}>
        <div>Dialog content</div>
      </AppDialogModal>
    );

    expect(screen.getByLabelText('dialog-modal')).toBeInTheDocument();
    expect(screen.getByText('Dialog content')).toBeInTheDocument();
  });

  it('dismisses on backdrop press by default', () => {
    const onClose = vi.fn();

    render(
      <AppDialogModal onClose={onClose} visible={true}>
        <div>Dismiss me</div>
      </AppDialogModal>
    );

    fireEvent.click(screen.getByTestId('app-dialog-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('can disable backdrop dismissal', () => {
    const onClose = vi.fn();

    render(
      <AppDialogModal
        dismissOnBackdropPress={false}
        onClose={onClose}
        visible={true}
      >
        <div>Persistent dialog</div>
      </AppDialogModal>
    );

    fireEvent.click(screen.getByTestId('app-dialog-backdrop'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not render content when hidden', () => {
    render(
      <AppDialogModal onClose={vi.fn()} visible={false}>
        <div>Should not appear</div>
      </AppDialogModal>
    );

    expect(screen.queryByLabelText('dialog-modal')).toBeNull();
    expect(screen.queryByText('Should not appear')).toBeNull();
  });

  it('can render inside the shared keyboard shell when keyboardAware is enabled', () => {
    const onClose = vi.fn();

    render(
      <AppDialogModal keyboardAware onClose={onClose} visible={true}>
        <div>Keyboard dialog</div>
      </AppDialogModal>
    );

    expect(
      screen.getByRole('region', { name: 'dialog-keyboard-shell' })
    ).toBeInTheDocument();
    expect(screen.getByText('Keyboard dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('app-dialog-backdrop')).toBeNull();
    expect(
      screen.getByTestId('app-dialog-keyboard-backdrop')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('app-dialog-keyboard-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
