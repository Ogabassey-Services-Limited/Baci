import Ionicons from '@react-native-vector-icons/ionicons';
import { type Href, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SPACING } from '@/constants/Colors';
import type { ThemeColors } from '@/hooks/useTheme';
import type { getHeaderStyles } from './header.styles';

type HeaderStyles = ReturnType<typeof getHeaderStyles>;

interface HeaderMinimalProps {
  colors: ThemeColors;
  handleSearchPress: () => void;
  insetsTop: number;
  isScrolled: boolean;
  itemCount: number;
  showSearch: boolean;
  storeName: string;
  styles: HeaderStyles;
}

export function HeaderMinimal({
  colors,
  handleSearchPress,
  insetsTop,
  isScrolled,
  itemCount,
  showSearch,
  storeName,
  styles,
}: HeaderMinimalProps) {
  return (
    <View
      testID="storefront-header"
      style={[
        styles.minimalContainer,
        isScrolled && { backgroundColor: colors.background },
        { paddingTop: insetsTop + SPACING.sm },
      ]}
    >
      <View style={styles.minimalContent}>
        <Text style={styles.minimalLogoText}>{storeName.split(' - ')[0]}</Text>
        <View style={styles.actionRow}>
          {showSearch ? (
            <Pressable
              onPress={handleSearchPress}
              hitSlop={12}
              style={styles.iconBtn}
              accessibilityLabel="Search products"
              accessibilityRole="button"
            >
              <Ionicons name="search-outline" size={24} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.navigate('/cart' as Href)}
            hitSlop={12}
            style={[styles.iconBtn, styles.rightIconBtn]}
            accessibilityLabel={
              itemCount > 0
                ? `Shopping cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
                : 'Shopping cart, empty'
            }
            accessibilityRole="button"
          >
            <Ionicons name="bag-outline" size={24} color={colors.text} />
            {itemCount > 0 ? (
              <View
                style={[styles.badge, { backgroundColor: colors.text }]}
                accessibilityElementsHidden={true}
              >
                <Text style={[styles.badgeText, { color: colors.background }]}>
                  {itemCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
