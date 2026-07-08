import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { AppSheetModal } from '@/components/ui/AppSheetModal';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { NewOrderEditItemActions } from './NewOrderEditItemActions';
import { getOrderItemVariantSummary } from './new-order-item-variant-summary';
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
    handleChangeEditingItemVariant,
    setEditDetails,
    setOrderItems,
    setShowEditItemModal,
    setEditPriceValue,
    setEditQtyValue,
    showEditItemModal,
  } = controller;
  const variantSummary = getOrderItemVariantSummary(editingItem);
  const canChangeVariant = Boolean(
    editingItem?.product_id &&
      editingItem.variant_id &&
      !editingItem.is_custom &&
      handleChangeEditingItemVariant
  );
  const shouldShowVariantCard = Boolean(variantSummary || canChangeVariant);

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
          {shouldShowVariantCard ? (
            <View
              style={{
                backgroundColor: colors.backgroundLight,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                gap: 8,
                padding: 14,
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  Variant
                </Text>
                {canChangeVariant ? (
                  <Pressable
                    accessibilityLabel="Change variant"
                    accessibilityRole="button"
                    onPress={handleChangeEditingItemVariant}
                    style={{ paddingHorizontal: 4, paddingVertical: 2 }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 13,
                        fontWeight: '800',
                      }}
                    >
                      Change
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Text
                numberOfLines={2}
                style={{
                  color: colors.text,
                  fontSize: 15,
                  fontWeight: '700',
                  lineHeight: 20,
                }}
              >
                {variantSummary || 'Variant options'}
              </Text>
            </View>
          ) : null}

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
                onChangeText={(text) =>
                  setEditQtyValue(text.replace(/[^0-9]/g, ''))
                }
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

        <NewOrderEditItemActions
          colors={colors}
          editDetails={editDetails}
          editingItem={editingItem}
          editPriceValue={editPriceValue}
          editQtyValue={editQtyValue}
          setOrderItems={setOrderItems}
          setShowEditItemModal={setShowEditItemModal}
        />
      </View>
    </AppSheetModal>
  );
}
