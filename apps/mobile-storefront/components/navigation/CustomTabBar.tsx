import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useKeyboard } from '@/hooks/use-keyboard';
import { CustomTabBarChrome } from './CustomTabBarChrome';

type CustomTabBarProps = BottomTabBarProps & {
  preloadProtectedTabs?: boolean;
};

export function CustomTabBar({
  preloadProtectedTabs = false,
  ...props
}: CustomTabBarProps) {
  const activeRouteName = props.state.routes[props.state.index]?.name ?? '';
  const { isKeyboardVisible } = useKeyboard();

  if (
    isKeyboardVisible ||
    activeRouteName === 'cart' ||
    activeRouteName === 'cart-tab'
  ) {
    return null;
  }

  return (
    <CustomTabBarChrome
      {...props}
      activeRouteName={activeRouteName}
      preloadProtectedTabs={preloadProtectedTabs}
    />
  );
}
