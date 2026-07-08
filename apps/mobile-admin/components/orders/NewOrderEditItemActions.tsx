import { Pressable, Text, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';

type NewOrderController = ReturnType<typeof useNewOrderController>;

interface NewOrderEditItemActionsProps {
  colors: NewOrderController['colors'];
  editDetails: string;
  editingItem: NewOrderController['editingItem'];
  editPriceValue: string;
  editQtyValue: string;
  setOrderItems: NewOrderController['setOrderItems'];
  setShowEditItemModal: NewOrderController['setShowEditItemModal'];
}

export function NewOrderEditItemActions({
  colors,
  editDetails,
  editingItem,
  editPriceValue,
  editQtyValue,
  setOrderItems,
  setShowEditItemModal,
}: NewOrderEditItemActionsProps) {
  const removeItem = () => {
    if (!editingItem) {
      return;
    }

    setOrderItems((previous) =>
      previous.filter((item) => item.id !== editingItem.id)
    );
    setShowEditItemModal(false);
  };

  const saveItem = () => {
    if (editingItem) {
      const finalPrice =
        Number.parseFloat(editPriceValue.replace(/,/g, '')) || 0;
      const finalQty = Math.max(1, Number.parseInt(editQtyValue, 10) || 1);
      setOrderItems((previous) =>
        previous.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                details: editDetails,
                price: finalPrice,
                quantity: finalQty,
              }
            : item
        )
      );
    }

    setShowEditItemModal(false);
  };

  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Pressable
        accessibilityLabel="Remove edited item"
        accessibilityRole="button"
        onPress={removeItem}
        style={{
          alignItems: 'center',
          borderColor: colors.error,
          borderRadius: 12,
          borderWidth: 1.5,
          flex: 1,
          paddingVertical: 16,
        }}
      >
        <Text style={{ color: colors.error, fontSize: 16, fontWeight: '800' }}>
          Remove
        </Text>
      </Pressable>

      <Pressable
        accessibilityLabel="Save edited item"
        accessibilityRole="button"
        onPress={saveItem}
        style={{
          alignItems: 'center',
          backgroundColor: colors.primary,
          borderRadius: 12,
          flex: 1,
          paddingVertical: 16,
        }}
      >
        <Text
          style={{
            color: colors.textOnPrimary,
            fontSize: 16,
            fontWeight: '800',
          }}
        >
          Save
        </Text>
      </Pressable>
    </View>
  );
}
