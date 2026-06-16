import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';

const quantityFormatter = new Intl.NumberFormat();

interface ProductStockControlsProps {
  colors: ThemeColors;
  lowStockThreshold: number;
  onLowStockThresholdChange: (value: number) => void;
  onStockAdjust: (nextQuantity: number) => void;
  stockQuantity: number;
  inventoryTrackingPolicy?:
    | 'off'
    | 'serialized_strict'
    | 'serialized_then_unlimited'
    | 'inherit'
    | null;
}

export function ProductStockControls({
  colors,
  lowStockThreshold,
  onLowStockThresholdChange,
  onStockAdjust,
  stockQuantity,
  inventoryTrackingPolicy,
}: ProductStockControlsProps) {
  const isSerialized =
    inventoryTrackingPolicy === 'serialized_strict' ||
    inventoryTrackingPolicy === 'serialized_then_unlimited';

  return (
    <>
      <Text style={[styles.title, { color: colors.text }]}>
        Stock Management
      </Text>
      <View style={styles.quantityRow}>
        <View>
          <Text style={[styles.quantityLabel, { color: colors.textSecondary }]}>
            {isSerialized ? 'Quantity (Read-only)' : 'Quantity'}{' '}
            <Text style={{ color: colors.error }}>*</Text>
          </Text>
          {isSerialized ? (
            <View
              style={[
                styles.quantityInput,
                {
                  alignItems: 'center',
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  justifyContent: 'center',
                },
              ]}
            >
              <Text
                style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}
              >
                {quantityFormatter.format(stockQuantity)}
              </Text>
            </View>
          ) : (
            <TextInput
              accessibilityLabel="Stock quantity"
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
                  : quantityFormatter.format(stockQuantity)
              }
              onChangeText={(text) => {
                const nextValue = Number.parseInt(text.replace(/,/g, ''), 10);
                onStockAdjust(
                  Math.max(0, Number.isNaN(nextValue) ? 0 : nextValue)
                );
              }}
              keyboardType="numeric"
            />
          )}
        </View>

        {!isSerialized && (
          <View style={styles.stockActions}>
            <Pressable
              accessibilityLabel="Decrease stock"
              accessibilityRole="button"
              style={[styles.stockButton, { backgroundColor: colors.error }]}
              onPress={() => onStockAdjust(Math.max(0, stockQuantity - 1))}
            >
              <Ionicons name="remove" size={20} color={colors.textOnPrimary} />
            </Pressable>
            <Pressable
              accessibilityLabel="Increase stock"
              accessibilityRole="button"
              style={[styles.stockButton, { backgroundColor: colors.success }]}
              onPress={() => onStockAdjust(stockQuantity + 1)}
            >
              <Ionicons name="add" size={20} color={colors.textOnPrimary} />
            </Pressable>
          </View>
        )}
      </View>
      <View style={styles.lowStockRow}>
        <Text style={[styles.lowStockLabel, { color: colors.textSecondary }]}>
          Low Stock Threshold
        </Text>
        <TextInput
          accessibilityLabel="Low stock threshold"
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
            onLowStockThresholdChange(Math.max(0, Number(text) || 0))
          }
          keyboardType="numeric"
          placeholder="3"
          placeholderTextColor={colors.textSecondary}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
});
