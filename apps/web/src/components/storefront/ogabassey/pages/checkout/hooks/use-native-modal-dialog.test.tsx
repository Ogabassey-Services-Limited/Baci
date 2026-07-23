import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNativeModalDialog } from './use-native-modal-dialog';

function Harness({ onDismiss }: { onDismiss?: () => void }) {
  const dialogRef = useNativeModalDialog(onDismiss);
  return (
    <dialog aria-label="test dialog" ref={dialogRef}>
      <button type="button">Inside</button>
    </dialog>
  );
}

describe('useNativeModalDialog', () => {
  it('opens the dialog on mount so its content is presented', () => {
    render(<Harness />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(screen.getByRole('button', { name: 'Inside' })).toBeDefined();
  });

  it('promotes the dialog to a real modal when showModal is available', () => {
    const showModal = vi.fn();
    const closeSpy = vi.fn();
    const originalShowModal = HTMLDialogElement.prototype.showModal;
    const originalClose = HTMLDialogElement.prototype.close;
    HTMLDialogElement.prototype.showModal = showModal;
    HTMLDialogElement.prototype.close = closeSpy;

    try {
      render(<Harness />);
      expect(showModal).toHaveBeenCalledTimes(1);
    } finally {
      HTMLDialogElement.prototype.showModal = originalShowModal;
      HTMLDialogElement.prototype.close = originalClose;
    }
  });

  it('invokes onDismiss on the native cancel (Escape) gesture', () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);

    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
