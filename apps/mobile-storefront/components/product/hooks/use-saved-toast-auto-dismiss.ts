import { useEffect, useRef } from 'react';

export function useSavedToastAutoDismiss(
  show: boolean,
  dismissSavedToast: () => void
) {
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show) {
      if (savedToastTimerRef.current) {
        clearTimeout(savedToastTimerRef.current);
      }
      savedToastTimerRef.current = setTimeout(() => {
        dismissSavedToast();
        savedToastTimerRef.current = null;
      }, 2000);
    }

    return () => {
      if (savedToastTimerRef.current) {
        clearTimeout(savedToastTimerRef.current);
        savedToastTimerRef.current = null;
      }
    };
  }, [show, dismissSavedToast]);
}
