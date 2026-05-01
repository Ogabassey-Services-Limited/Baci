import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import SafeImage from '@/components/ui/SafeImage';
import { getTranslucentColor } from '@/lib/colors/sanitize-css-color';
import { NewOrderSummarySection } from './NewOrderSummarySection';
import { styles } from './new-order.styles';

interface NewOrderItemsSectionProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderItemsSection({
  controller,
}: NewOrderItemsSectionProps) {
  const {
    colors,
    formatPrice,
    handleQuantityChange,
    orderItems,
    resetProductPickerState,
    setEditDetails,
    setEditingItem,
    setEditPriceValue,
    setEditQtyValue,
    setProductSearch,
    setShowCustomItemModal,
    setShowEditItemModal,
    setShowProductModal,
  } = controller;

  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Products
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        <Pressable
          accessibilityLabel="Quick add item"
          accessibilityRole="button"
          accessible
          onPress={() => setShowCustomItemModal(true)}
          style={[
            styles.actionBtn,
            {
              backgroundColor: getTranslucentColor(
                colors.primary,
                colors.backgroundLight,
                0.06
              ),
              borderColor: getTranslucentColor(
                colors.primary,
                colors.border,
                0.14
              ),
            },
          ]}
        >
          <Ionicons color={colors.primary} name="flash-outline" size={18} />
          <Text style={[styles.actionBtnText, { color: colors.primary }]}>
            Quick Add
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Search catalog"
          accessibilityRole="button"
          accessible
          onPress={() => {
            resetProductPickerState();
            setProductSearch('');
            setShowProductModal(true);
          }}
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.backgroundLight,
              borderColor: colors.border,
              flex: 1.2,
            },
          ]}
        >
          <Ionicons color={colors.textSecondary} name="search" size={16} />
          <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
            Search Catalog
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: 8, marginTop: 12 }}>
        {orderItems.length === 0 ? (
          <View style={[styles.emptyState, { borderColor: colors.border }]}>
            <Text style={{ color: colors.textMuted }}>No items added yet</Text>
          </View>
        ) : (
          orderItems.map((item) => (
            <View
              key={item.id}
              style={[
                styles.itemCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.itemThumbnail,
                  { backgroundColor: colors.backgroundLight },
                ]}
              >
                {item.image_url ? (
                  <SafeImage
                    source={{ uri: item.image_url }}
                    style={{ borderRadius: 12, height: '100%', width: '100%' }}
                  />
                ) : (
                  <Ionicons
                    color={colors.textMuted}
                    name="image-outline"
                    size={20}
                  />
                )}
              </View>

              <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <Text
                  numberOfLines={2}
                  style={[styles.itemTitle, { color: colors.text }]}
                >
                  {item.name}
                </Text>
                {item.details ? (
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                      marginBottom: 2,
                    }}
                  >
                    {item.details}
                  </Text>
                ) : null}
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    fontWeight: '600',
                    marginTop: 2,
                  }}
                >
                  {formatPrice(item.price)}
                </Text>
                <Pressable
                  accessibilityLabel={`Edit item ${item.name}`}
                  accessibilityRole="button"
                  accessible
                  onPress={() => {
                    setEditingItem(item);
                    setEditPriceValue(item.price.toString());
                    setEditQtyValue(item.quantity.toString());
                    setEditDetails(item.details || '');
                    setShowEditItemModal(true);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 1.5,
                    marginTop: 6,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 13,
                      fontWeight: '700',
                      paddingBottom: 1,
                    }}
                  >
                    Edit
                  </Text>
                </Pressable>
              </View>

              <View style={styles.itemActions}>
                <Pressable
                  accessibilityLabel={`${
                    item.quantity > 1 ? 'Decrease' : 'Remove'
                  } quantity for ${item.name}, current ${item.quantity}`}
                  accessibilityRole="button"
                  accessible
                  hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                  onPress={() => handleQuantityChange(item.id, -1)}
                  style={[styles.qtyBtn, { backgroundColor: colors.backgroundLight }]}
                >
                  <Ionicons
                    color={item.quantity > 1 ? colors.text : colors.error}
                    name={item.quantity > 1 ? 'remove' : 'trash-outline'}
                    size={16}
                  />
                </Pressable>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: 'bold',
                    minWidth: 24,
                    textAlign: 'center',
                  }}
                >
                  {item.quantity}
                </Text>
                <Pressable
                  accessibilityLabel={`Increase quantity for ${item.name}, current ${item.quantity}`}
                  accessibilityRole="button"
                  accessible
                  hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                  onPress={() => handleQuantityChange(item.id, 1)}
                  style={[styles.qtyBtn, { backgroundColor: colors.backgroundLight }]}
                >
                  <Ionicons color={colors.text} name="add" size={16} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <NewOrderSummarySection controller={controller} />
    </View>
  );
}
