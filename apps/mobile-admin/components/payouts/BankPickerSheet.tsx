import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { PaystackBank } from '@/hooks/usePaystackBanks';
import { useTheme } from '@/hooks/useTheme';

interface BankPickerSheetProps {
  banks: PaystackBank[];
  isLoading: boolean;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (bank: PaystackBank) => void;
  searchTerm: string;
  selectedBankCode: string | null;
  visible: boolean;
}

export function BankPickerSheet({
  banks,
  isLoading,
  onClose,
  onSearchChange,
  onSelect,
  searchTerm,
  selectedBankCode,
  visible,
}: BankPickerSheetProps) {
  const { colors } = useTheme();

  return (
    <AppPageSheet
      closeLabel="Close bank picker"
      contentContainerStyle={styles.pageSheetContent}
      onClose={onClose}
      scrollEnabled={false}
      title="Select Bank"
      visible={visible}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.searchSection}>
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              color={colors.textMuted}
              name="search"
              size={20}
              style={styles.searchIcon}
            />
            <TextInput
              accessibilityLabel="Search banks"
              autoCorrect={false}
              keyboardType="default"
              onChangeText={onSearchChange}
              placeholder="Search banks..."
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={[styles.searchInput, { color: colors.text }]}
              value={searchTerm}
            />
            {searchTerm.length > 0 ? (
              <Pressable
                accessibilityHint="Clears the bank search input"
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                onPress={() => onSearchChange('')}
              >
                <Ionicons
                  color={colors.textMuted}
                  name="close-circle"
                  size={18}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            size="large"
            style={styles.loader}
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.bankList}
            data={banks}
            initialNumToRender={15}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.code}
            maxToRenderPerBatch={10}
            removeClippedSubviews={Platform.OS === 'android'}
            windowSize={5}
            ListEmptyComponent={
              <Text
                style={[styles.emptyStateText, { color: colors.textMuted }]}
              >
                No banks found
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = selectedBankCode === item.code;

              return (
                <Pressable
                  accessibilityLabel={item.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelect(item)}
                  style={[
                    styles.bankItem,
                    {
                      backgroundColor: isSelected
                        ? colors.primaryLight
                        : colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.bankName,
                      {
                        color: isSelected ? colors.primary : colors.text,
                        fontWeight: isSelected ? 'bold' : 'normal',
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                  {isSelected ? (
                    <Ionicons
                      color={colors.primary}
                      name="checkmark-circle"
                      size={20}
                    />
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </AppPageSheet>
  );
}

const styles = StyleSheet.create({
  pageSheetContent: {
    padding: 0,
  },
  container: { flex: 1 },
  searchSection: {
    padding: SPACING.md,
    paddingBottom: 0,
  },
  searchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    height: '100%' as const,
  },
  loader: {
    marginTop: SPACING.xl,
  },
  bankList: {
    padding: SPACING.md,
  },
  bankItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  bankName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  emptyStateText: {
    padding: SPACING.lg,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});
