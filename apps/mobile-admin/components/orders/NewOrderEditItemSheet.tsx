import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AppSheetModal } from '@/components/ui/AppSheetModal';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { formatPriceInput, parseDecimalInput } from './new-order.shared';

interface NewOrderEditItemSheetProps {
  controller: ReturnType<typeof useNewOrderController>;
  currencySymbol?: string;
}

export function NewOrderEditItemSheet({
  controller,
  currencySymbol = '₦',
}: NewOrderEditItemSheetProps) {
  const {
    colors,
    editDetails,
    editingItem,
    editPriceValue,
    editQtyValue,
    setEditDetails,
    setOrderItems,
    setShowEditItemModal,
    setEditPriceValue,
    setEditQtyValue,
    showEditItemModal,
  } = controller;

  return (
    <AppSheetModal
      accessibilityLabel="Edit order item sheet"
      onClose={() => setShowEditItemModal(false)}
      visible={showEditItemModal}
    >
      <View
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 24,
        }}
      >
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
            Edit item
          </Text>
          <Pressable
            accessibilityLabel="Close edit item sheet"
            accessibilityRole="button"
            onPress={() => setShowEditItemModal(false)}
            style={{ padding: 4 }}
          >
            <Ionicons color={colors.text} name="close" size={26} />
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: `${colors.primary}10`,
            borderColor: `${colors.primary}20`,
            borderRadius: 12,
            borderWidth: 1,
            marginBottom: 24,
            padding: 16,
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 13,
              fontWeight: '600',
              lineHeight: 18,
            }}
          >
            Edits made here apply only to this sale and won’t update your
            store’s inventory
          </Text>
        </View>

        <View style={{ gap: 20, marginBottom: 32 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1.5 }}>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  fontWeight: '600',
                  marginBottom: 6,
                  marginLeft: 4,
                }}
              >
                Price
              </Text>
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: colors.backgroundLight,
                  borderColor: colors.border,
                  borderRadius: 12,
                  borderWidth: 1,
                  flexDirection: 'row',
                  paddingHorizontal: 12,
                }}
              >
                <Text
                  style={{ color: colors.text, fontSize: 16, marginRight: 4 }}
                >
                  {currencySymbol}
                </Text>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(text) => {
                    setEditPriceValue(parseDecimalInput(text));
                  }}
                  style={{
                    color: colors.text,
                    flex: 1,
                    fontSize: 16,
                    fontWeight: '600',
                    paddingVertical: 14,
                  }}
                  value={formatPriceInput(editPriceValue)}
                />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  fontWeight: '600',
                  marginBottom: 6,
                  marginLeft: 4,
                }}
              >
                Quantity
              </Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(text) => {
                  const clamped = Math.max(1, Math.floor(Number(text) || 1));
                  setEditQtyValue(String(clamped));
                }}
                style={{
                  backgroundColor: colors.backgroundLight,
                  borderColor: colors.border,
                  borderRadius: 12,
                  borderWidth: 1,
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: '600',
                  padding: 14,
                }}
                value={editQtyValue}
              />
            </View>
          </View>

          <TextInput
            multiline
            onChangeText={setEditDetails}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.backgroundLight,
              borderColor: colors.border,
              borderRadius: 12,
              borderWidth: 1,
              color: colors.text,
              fontSize: 15,
              height: 100,
              padding: 16,
              textAlignVertical: 'top',
            }}
            value={editDetails}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            accessibilityLabel="Remove edited item"
            accessibilityRole="button"
            onPress={() => {
              if (editingItem) {
                setOrderItems((previous) =>
                  previous.filter((item) => item.id !== editingItem.id)
                );
                setShowEditItemModal(false);
              }
            }}
            style={{
              alignItems: 'center',
              borderColor: colors.error,
              borderRadius: 12,
              borderWidth: 1.5,
              flex: 1,
              paddingVertical: 16,
            }}
          >
            <Text
              style={{ color: colors.error, fontSize: 16, fontWeight: '800' }}
            >
              Remove
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Save edited item"
            accessibilityRole="button"
            onPress={() => {
              if (editingItem) {
                const finalPrice =
                  Number.parseFloat(editPriceValue.replace(/,/g, '')) || 0;
                const finalQty = Math.max(
                  1,
                  Number.parseInt(editQtyValue, 10) || 1
                );
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
            }}
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
      </View>
    </AppSheetModal>
  );
}
