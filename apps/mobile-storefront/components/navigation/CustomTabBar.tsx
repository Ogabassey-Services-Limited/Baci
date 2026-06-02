import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useKeyboard } from '@/hooks/use-keyboard';
import { CustomTabBarChrome } from './CustomTabBarChrome';

export function CustomTabBar(props: BottomTabBarProps) {
  const activeRouteName = props.state.routes[props.state.index]?.name ?? '';
  const { isKeyboardVisible } = useKeyboard();

  if (isKeyboardVisible || activeRouteName === 'cart') {
    return null;
  }

  return <CustomTabBarChrome {...props} activeRouteName={activeRouteName} />;
}
