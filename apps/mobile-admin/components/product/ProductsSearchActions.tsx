import Ionicons from '@react-native-vector-icons/ionicons';
import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

type ProductsSearchActionsProps = {
  colors: ThemeColors;
  isVisible: boolean;
  onClearSearch: () => void;
  onScanPress: () => void;
  onSearchChange: (value: string) => void;
  searchBarAnim: Animated.Value;
  searchQuery: string;
};

export function ProductsSearchActions({
  colors,
  isVisible,
  onClearSearch,
  onScanPress,
  onSearchChange,
  searchBarAnim,
  searchQuery,
}: ProductsSearchActionsProps) {
  return (
    <Animated.View
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.searchContainer,
        {
          opacity: searchBarAnim,
          pointerEvents: isVisible ? 'auto' : 'none',
          transform: [
            {
              translateY: searchBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-60, 0],
              }),
            },
            {
              scaleY: searchBarAnim,
            },
          ],
        },
      ]}
    >
      <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search products..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={onSearchChange}
          editable={isVisible}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search products"
          accessibilityRole="search"
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={onClearSearch}
            disabled={!isVisible}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            accessibilityState={{ disabled: !isVisible }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.scanButton,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.75 },
        ]}
        onPress={onScanPress}
        disabled={!isVisible}
        accessibilityLabel="Scan barcode"
        accessibilityRole="button"
        accessibilityState={{ disabled: !isVisible }}
        accessibilityHint="Opens barcode scanner to find products"
      >
        <Ionicons
          name="barcode-outline"
          size={22}
          color={colors.textOnPrimary}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  scanButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  searchContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  searchInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    paddingVertical: SPACING.xs,
  },
});
