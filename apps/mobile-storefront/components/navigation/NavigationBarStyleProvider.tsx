import * as NavigationBar from 'expo-navigation-bar';
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { Platform } from 'react-native';

export type NavigationBarButtonStyle = 'dark' | 'light';

const NavigationBarStyleOverrideContext = createContext<Dispatch<
  SetStateAction<NavigationBarButtonStyle | null>
> | null>(null);

export function NavigationBarStyleProvider({
  children,
  rootStyle,
}: PropsWithChildren<{ rootStyle: NavigationBarButtonStyle }>) {
  const [overrideStyle, setOverrideStyle] =
    useState<NavigationBarButtonStyle | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    void NavigationBar.setStyle(overrideStyle ?? rootStyle);
  }, [overrideStyle, rootStyle]);

  return (
    <NavigationBarStyleOverrideContext.Provider value={setOverrideStyle}>
      {children}
    </NavigationBarStyleOverrideContext.Provider>
  );
}

export function useNavigationBarStyleOverride(
  style: NavigationBarButtonStyle | null
) {
  const setOverrideStyle = useContext(NavigationBarStyleOverrideContext);

  useLayoutEffect(() => {
    if (!setOverrideStyle) {
      return;
    }

    setOverrideStyle(style);
    return () => {
      setOverrideStyle(null);
    };
  }, [setOverrideStyle, style]);

  return setOverrideStyle !== null;
}
