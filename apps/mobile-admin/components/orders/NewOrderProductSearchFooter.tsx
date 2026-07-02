import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import type { TextInput as BottomSheetTextInputRef } from 'react-native-gesture-handler';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface NewOrderProductSearchFooterProps {
  autoFocus?: boolean;
  colors: {
    primary: string;
    text: string;
    textMuted: string;
  };
  inputRef: RefObject<BottomSheetTextInputRef | null | undefined>;
  productSearch: string;
  setProductSearch: (search: string) => void;
}

export function NewOrderProductSearchFooter({
  autoFocus = false,
  colors,
  inputRef,
  productSearch,
  setProductSearch,
}: NewOrderProductSearchFooterProps) {
  const { isDark } = useTheme();

  return (
    <View testID="product-search-footer">
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: isDark
              ? 'rgba(26, 26, 46, 0.88)'
              : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.13)'
              : 'rgba(15, 23, 42, 0.1)',
            shadowColor: isDark ? '#000000' : colors.primary,
          },
        ]}
      >
        <Ionicons color={colors.textMuted} name="search" size={20} />
        <BottomSheetTextInput
          ref={inputRef}
          accessibilityHint="Type to filter the product list"
          accessibilityLabel="Search products"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          onChangeText={setProductSearch}
          placeholder="Search products..."
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
          value={productSearch}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  input: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    marginLeft: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
});
