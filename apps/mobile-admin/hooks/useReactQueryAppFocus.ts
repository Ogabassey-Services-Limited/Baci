import { focusManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useReactQueryAppFocus(): void {
  useEffect(() => {
    const updateFocus = (state: AppStateStatus) => {
      focusManager.setFocused(state === 'active');
    };

    updateFocus(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateFocus);

    return () => {
      subscription.remove();
    };
  }, []);
}
