import Ionicons, {
  type IoniconsIconName,
} from '@react-native-vector-icons/ionicons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { BRAND } from '@/constants/Colors';
import styles from './DrawerMenu.styles';

type DrawerMenuItemColors = {
  icon: string;
  text: string;
  textSecondary: string;
  card: string;
};

type DrawerMenuItemsProps = {
  colors: DrawerMenuItemColors;
  isAuthenticated: boolean;
  pathname?: string;
  onNavigate: (path: string) => void;
};

type MenuItem = {
  label: string;
  icon: IoniconsIconName;
  path: string;
  authRequired?: boolean;
};

const menuItems: MenuItem[] = [
  {
    label: 'My Account',
    icon: 'person-outline',
    path: '/account',
    authRequired: true,
  },
  { label: 'Orders', icon: 'bag-outline', path: '/orders' },
  { label: 'Receipts', icon: 'document-text-outline', path: '/receipts' },
  { label: 'Saved Items', icon: 'heart-outline', path: '/saved' },
  { label: 'IMEI Checker', icon: 'scan-outline', path: '/imei-check' },
  { label: 'Wallet', icon: 'wallet-outline', path: '/wallet' },
  { label: 'Address Book', icon: 'location-outline', path: '/addresses' },
  { label: 'Repairs', icon: 'construct-outline', path: '/repairs' },
  { label: 'Swap / Trade-in', icon: 'swap-horizontal-outline', path: '/swap' },
  { label: 'Help & Support', icon: 'help-circle-outline', path: '/faq' },
];

export function DrawerMenuItems({
  colors,
  isAuthenticated,
  pathname,
  onNavigate,
}: DrawerMenuItemsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const redIconColor = isDark ? '#ff5555' : BRAND.primary;

  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(`${path}/`);

  return (
    <ScrollView
      style={styles.menuList}
      contentContainerStyle={styles.menuListContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        ACCOUNT
      </Text>
      {menuItems
        .filter((item) => !item.authRequired || isAuthenticated)
        .map((item) => {
          const active = isActive(item.path);
          return (
            <Pressable
              key={item.path}
              style={[
                styles.menuItem,
                { backgroundColor: colors.card },
                active && styles.menuItemActive,
              ]}
              onPress={() => onNavigate(item.path)}
              accessibilityLabel={item.label}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.menuItemContent}>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={redIconColor}
                  style={{ opacity: active ? 1 : 0.65 }}
                />
                <Text
                  style={[
                    styles.menuItemLabel,
                    { color: colors.text },
                    active && styles.menuItemLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
    </ScrollView>
  );
}
