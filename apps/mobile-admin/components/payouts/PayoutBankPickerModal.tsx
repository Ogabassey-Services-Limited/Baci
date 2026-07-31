import Ionicons from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppKeyboardContainer } from '@/components/ui/AppKeyboardContainer';
import { getVirtualizedListProps } from '@/components/ui/virtualized-list-props';
import { SPACING, type ThemeColors, TYPOGRAPHY } from '@/constants/theme';
import type { PaystackBank } from '@/hooks/usePaystackBanks';

interface PayoutBankPickerModalProps {
  banks: PaystackBank[];
  colors: Pick<
    ThemeColors,
    'background' | 'border' | 'primary' | 'text' | 'textMuted'
  >;
  isLoading: boolean;
  onClose: () => void;
  onSelect: (bank: PaystackBank) => void;
  selectedBank: PaystackBank | null;
  visible: boolean;
}

export function PayoutBankPickerModal({
  banks,
  colors,
  isLoading,
  onClose,
  onSelect,
  selectedBank,
  visible,
}: PayoutBankPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredBanks = banks.filter((bank) =>
    bank.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const close = () => {
    setSearchTerm('');
    onClose();
  };

  const selectBank = (bank: PaystackBank) => {
    onSelect(bank);
    close();
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={close}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <AppKeyboardContainer
        align="start"
        scrollEnabled={false}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              Select Bank
            </Text>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={close}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <View
            style={[
              styles.searchContainer,
              { borderBottomColor: colors.border },
            ]}
          >
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              onChangeText={setSearchTerm}
              placeholder="Search banks..."
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
              value={searchTerm}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator
              color={colors.primary}
              size="large"
              style={styles.loader}
            />
          ) : (
            <FlatList
              data={filteredBanks}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.code}
              {...getVirtualizedListProps()}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: selectedBank?.code === item.code,
                  }}
                  onPress={() => selectBank(item)}
                  style={[
                    styles.bankItem,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={[styles.bankName, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  {selectedBank?.code === item.code ? (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.primary}
                    />
                  ) : null}
                </Pressable>
              )}
            />
          )}
        </View>
      </AppKeyboardContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  closeButton: { padding: SPACING.sm, position: 'absolute', right: SPACING.md },
  searchContainer: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.size.md, height: 40 },
  loader: { marginTop: SPACING.lg },
  bankItem: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  bankName: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
  },
});
