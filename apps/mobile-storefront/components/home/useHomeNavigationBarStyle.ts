import { NavigationContext } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

type HomeColorScheme = 'dark' | 'light' | null | undefined;

export function useHomeNavigationBarStyle(colorScheme: HomeColorScheme) {
  const navigation = useContext(NavigationContext);
  const [isFocused, setIsFocused] = useState(
    () => navigation?.isFocused() ?? true
  );

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
    if (Platform.OS !== 'android') {
      return;
    }

    const restoreRootNavigationBarStyle = () => {
      void NavigationBar.setStyle(colorScheme === 'dark' ? 'light' : 'dark');
    };

    if (!isFocused) {
      restoreRootNavigationBarStyle();
      return;
    }

    void NavigationBar.setStyle('light');
    return restoreRootNavigationBarStyle;
  }, [colorScheme, isFocused]);
}
