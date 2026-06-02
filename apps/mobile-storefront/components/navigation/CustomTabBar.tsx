import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CustomTabBarChrome } from './CustomTabBarChrome';

export function CustomTabBar(props: BottomTabBarProps) {
  const activeRouteName = props.state.routes[props.state.index]?.name ?? '';

  if (activeRouteName === 'cart') {
    return null;
  }

  return <CustomTabBarChrome {...props} activeRouteName={activeRouteName} />;
}
