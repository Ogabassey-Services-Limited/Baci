import { NavigationContext } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { useContext, useEffect, useState } from 'react';
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
  const [isFocused, setIsFocused] = useState(
    () => navigation?.isFocused() ?? true
  );
  const overrideStyle =
    Platform.OS === 'android' && enabled && isFocused ? 'light' : null;
  const hasNavigationBarStyleProvider =
    useNavigationBarStyleOverride(overrideStyle);

  useEffect(() => {
    if (!navigation) {
      setIsFocused(true);
      return;
    }

    setIsFocused(navigation.isFocused());
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);

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
