import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';

interface ProductInventoryCardProps {
  colors: ThemeColors;
  fulfillmentCount: number;
  lowStockThreshold: number;
  manageStock: boolean;
  onLowStockThresholdChange: (value: number) => void;
  onOpenFulfillmentModal: () => void;
  onStockAdjust: (nextQuantity: number) => void;
  onToggleManageStock: (value: boolean) => void;
  stockQuantity: number;
}

export function ProductInventoryCard({
  colors,
  fulfillmentCount,
  lowStockThreshold,
  manageStock,
  onLowStockThresholdChange,
  onOpenFulfillmentModal,
  onStockAdjust,
  onToggleManageStock,
  stockQuantity,
}: ProductInventoryCardProps) {
  return (
    <>
      <View
        style={[
          styles.toggleCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.toggleTextBlock}>
          <Text style={[styles.title, { color: colors.text }]}>
            Track Inventory
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Automatically manage stock levels and fulfillments.
          </Text>
        </View>
        <Switch
          value={manageStock}
          onValueChange={onToggleManageStock}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={manageStock ? colors.primary : undefined}
        />
      </View>

      {manageStock ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.fulfillmentHeader}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                Fulfillment Details
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Manage unique identifiers (IMEI, S/N).
              </Text>
            </View>
            <Ionicons
              name="barcode-outline"
              size={24}
              color={colors.primary}
            />
          </View>

          <View style={styles.stockSummaryRow}>
            <View>
              <Text style={[styles.unitCount, { color: colors.text }]}>
                {fulfillmentCount} Units
              </Text>
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                Needs {stockQuantity} identifiers
              </Text>
            </View>
            <Pressable
              style={[styles.fulfillmentButton, { backgroundColor: colors.primary }]}
              onPress={onOpenFulfillmentModal}
            >
              <Text style={[styles.fulfillmentButtonText, { color: colors.textOnPrimary }]}>
                {fulfillmentCount > 0 ? 'View/Edit Items' : 'Add Details'}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.text }]}>
            Stock Management
          </Text>
          <View style={styles.quantityRow}>
            <View>
              <Text style={[styles.quantityLabel, { color: colors.textSecondary }]}>
                Quantity <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.quantityInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={
                  stockQuantity === 0
                    ? ''
                    : new Intl.NumberFormat().format(stockQuantity)
                }
                onChangeText={(text) => {
                  const nextValue = Number.parseInt(text.replace(/,/g, ''), 10);
                  onStockAdjust(Number.isNaN(nextValue) ? 0 : nextValue);
                }}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.stockActions}>
              <Pressable
                style={[styles.stockButton, { backgroundColor: colors.error }]}
                onPress={() => onStockAdjust(stockQuantity - 1)}
              >
                <Ionicons
                  name="remove"
                  size={20}
                  color={colors.textOnPrimary}
                />
              </Pressable>
              <Pressable
                style={[styles.stockButton, { backgroundColor: colors.success }]}
                onPress={() => onStockAdjust(stockQuantity + 1)}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={colors.textOnPrimary}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.lowStockRow}>
            <Text style={[styles.lowStockLabel, { color: colors.textSecondary }]}>
              Low Stock Threshold
            </Text>
            <TextInput
              style={[
                styles.thresholdInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={lowStockThreshold.toString()}
              onChangeText={(text) =>
                onLowStockThresholdChange(Number(text) || 0)
              }
              keyboardType="numeric"
              placeholder="3"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  fulfillmentButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fulfillmentButtonText: {
    fontWeight: '600',
  },
  fulfillmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  helperText: {
    fontSize: 12,
  },
  lowStockLabel: {
    fontSize: 13,
  },
  lowStockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  quantityInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    padding: 12,
    textAlign: 'center',
    width: 120,
  },
  quantityLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  quantityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stockActions: {
    flexDirection: 'row',
    gap: 8,
  },
  stockButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stockSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 13,
  },
  thresholdInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    textAlign: 'center',
    width: 80,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  toggleCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  toggleTextBlock: {
    flex: 1,
    marginRight: 16,
  },
  unitCount: {
    fontSize: 16,
    fontWeight: '600',
  },
});
