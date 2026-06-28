import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MobileUpdateModal } from './MobileUpdateModal';

vi.mock('@/components/ui/AppDialogModal', () => ({
  AppDialogModal: ({
    children,
    dismissOnBackdropPress,
    onClose,
    visible,
  }: {
    children?: ReactNode;
    dismissOnBackdropPress?: boolean;
    onClose?: () => void;
    visible?: boolean;
  }) => {
    const canDismiss = dismissOnBackdropPress !== false;
    return visible ? (
      <section
        aria-label="update-modal"
        data-dismissible={canDismiss ? 'true' : 'false'}
      >
        {canDismiss ? (
          <button aria-label="dialog close" onClick={onClose} type="button">
            close
          </button>
        ) : null}
        <button
          aria-label="dialog backdrop"
          onClick={canDismiss ? onClose : undefined}
          type="button"
        >
          backdrop
        </button>
        {children}
      </section>
    ) : null;
  },
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      backdrop: 'rgba(0, 0, 0, 0.55)',
      border: '#2A2A40',
      card: '#1A1A2E',
      primary: '#4A90D9',
      text: '#FFFFFF',
      textOnPrimary: '#FFFFFF',
      textSecondary: '#9CA3AF',
    },
  }),
}));

vi.mock('react-native', () => ({
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

describe('MobileUpdateModal', () => {
  it('renders nothing when not visible or prompt is missing', () => {
    const { rerender } = render(
      <MobileUpdateModal
        visible={false}
        prompt={{ kind: 'ota-available', message: 'Ready.' }}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('update-modal')).toBeNull();

    rerender(
      <MobileUpdateModal
        visible
        prompt={null}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('update-modal')).toBeNull();
  });

  it('renders optional OTA update actions', () => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();

    render(
      <MobileUpdateModal
        visible
        prompt={{
          kind: 'ota-available',
          message: 'A faster version of the admin app is ready.',
        }}
        onAccept={onAccept}
        onDismiss={onDismiss}
      />
    );

    expect(
      screen.getByText('A faster version of the admin app is ready.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('renders recommended native update actions', () => {
    render(
      <MobileUpdateModal
        visible
        prompt={{
          kind: 'native-recommended',
          message: 'A newer app version is available.',
          storeUrl: 'https://apps.apple.com/app/id6472735367',
        }}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(
      screen.getByText('A newer app version is available.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open store' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
  });

  it('hides the dismiss action for required native updates', () => {
    const onDismiss = vi.fn();

    render(
      <MobileUpdateModal
        visible
        prompt={{
          kind: 'native-required',
          message: 'Install the latest app to continue.',
          storeUrl: 'https://apps.apple.com/app/id6472735367',
        }}
        onAccept={vi.fn()}
        onDismiss={onDismiss}
      />
    );

    expect(
      screen.getByText('Install the latest app to continue.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open store' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'dialog close' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'dialog backdrop' }));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
