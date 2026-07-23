'use client';

import { useEffect, useRef } from 'react';

/**
 * Promotes a `<dialog>` to a real modal so it traps keyboard focus and restores
 * it on close — a bare `open` attribute leaves focus on the launcher and lets
 * keyboard users tab to controls behind the overlay.
 *
 * Attach the returned ref to the `<dialog>` and DO NOT pass an `open` attribute
 * (calling `showModal()` on an already-open dialog throws). `onDismiss` fires
 * for the native cancel gesture (Escape) so React state stays in sync.
 *
 * `showModal`/`close` are feature-detected because jsdom (the test environment)
 * does not implement them; there the dialog falls back to an open attribute so
 * its content stays queryable.
 */
export function useNativeModalDialog(onDismiss?: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      // jsdom / unsupported: keep the dialog rendered and queryable.
      dialog.setAttribute('open', '');
    }

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onDismissRef.current?.();
    };
    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return dialogRef;
}
