import * as NavigationBar from 'expo-navigation-bar';
import { NavigationContext } from 'expo-router/react-navigation';
import { useContext, useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import {
  type NavigationBarButtonStyle,
  useNavigationBarStyleOverride,
} from '@/components/navigation/NavigationBarStyleProvider';

type HomeColorScheme = 'dark' | 'light' | null | undefined;

export function useHomeNavigationBarStyle(
  colorScheme: HomeColorScheme,
  enabled = true
) {
  const navigation = useContext(NavigationContext);
  // Navigation focus is external state; subscribe to it instead of mirroring
  // it into React state from an effect.
  const isFocused = useSyncExternalStore(
    (onStoreChange) => {
      if (!navigation) {
        return () => undefined;
      }

      const unsubscribeFocus = navigation.addListener('focus', onStoreChange);
      const unsubscribeBlur = navigation.addListener('blur', onStoreChange);

      return () => {
        unsubscribeFocus();
        unsubscribeBlur();
      };
    },
    () => navigation?.isFocused() ?? true
  );
  const overrideStyle =
    Platform.OS === 'android' && enabled && isFocused ? 'light' : null;
  const hasNavigationBarStyleProvider =
    useNavigationBarStyleOverride(overrideStyle);

  useEffect(() => {
    if (hasNavigationBarStyleProvider || Platform.OS !== 'android') {
      return;
    }

    const rootStyle: NavigationBarButtonStyle =
      colorScheme === 'dark' ? 'light' : 'dark';
    const restoreRootNavigationBarStyle = () => {
      void NavigationBar.setStyle(rootStyle);
    };

    if (!enabled || !isFocused) {
      restoreRootNavigationBarStyle();
      return;
    }

    void NavigationBar.setStyle('light');
    return restoreRootNavigationBarStyle;
  }, [colorScheme, enabled, hasNavigationBarStyleProvider, isFocused]);
}
