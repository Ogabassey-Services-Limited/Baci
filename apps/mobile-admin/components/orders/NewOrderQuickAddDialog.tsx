import { Pressable, Text, TextInput, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { AppDialogModal } from '@/components/ui/AppDialogModal';
import { formatPriceInput } from './new-order.shared';
import { styles } from './new-order.styles';

interface NewOrderQuickAddDialogProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderQuickAddDialog({
  controller,
}: NewOrderQuickAddDialogProps) {
  const {
    colors,
    customItem,
    handleAddCustomItem,
    setCustomItem,
    setShowCustomItemModal,
    showCustomItemModal,
  } = controller;

  return (
    <AppDialogModal
      contentContainerStyle={styles.modalKeyboardCenterContent}
      keyboardAware
      onClose={() => setShowCustomItemModal(false)}
      visible={showCustomItemModal}
    >
      <View style={[styles.dialog, { backgroundColor: colors.card }]}>
        <Text style={[styles.dialogTitle, { color: colors.text }]}>
          Quick Add Item
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 13,
            fontStyle: 'italic',
            marginBottom: 16,
          }}
        >
          This item will not be saved to your product inventory.
        </Text>
        <TextInput
          onChangeText={(text) => setCustomItem((previous) => ({ ...previous, name: text }))}
          placeholder="Item Name (e.g. Red Cake, Delivery)"
          placeholderTextColor={colors.textMuted}
          style={[styles.dialogInput, { backgroundColor: colors.inputBg, color: colors.text }]}
          value={customItem.name}
        />
        <TextInput
          keyboardType="numeric"
          onChangeText={(text) => {
            const clean = text.replace(/[^0-9.]/g, '');
            setCustomItem((previous) => ({ ...previous, price: clean }));
          }}
          placeholder="Amount (0.00)"
          placeholderTextColor={colors.textMuted}
          style={[styles.dialogInput, { backgroundColor: colors.inputBg, color: colors.text }]}
          value={formatPriceInput(customItem.price)}
        />
        <View style={styles.dialogActions}>
          <Pressable
            onPress={() => setShowCustomItemModal(false)}
            style={styles.dialogBtn}
          >
            <Text style={{ color: colors.textSecondary }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleAddCustomItem}
            style={[
              styles.dialogBtn,
              { backgroundColor: colors.success, borderRadius: 8 },
            ]}
          >
            <Text style={{ color: colors.textOnPrimary, fontWeight: 'bold' }}>
              Add to Cart
            </Text>
          </Pressable>
        </View>
      </View>
    </AppDialogModal>
  );
}
