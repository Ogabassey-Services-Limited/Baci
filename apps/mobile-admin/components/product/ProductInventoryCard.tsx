import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { ProductStockControls } from './ProductStockControls';

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
  const unlimitedStockEnabled = !manageStock;

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
            Set unlimited stock
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {unlimitedStockEnabled
              ? 'Orders can be placed without checking stock quantity.'
              : 'Turn on to allow orders without checking stock quantity.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Set unlimited stock"
          accessibilityRole="switch"
          value={unlimitedStockEnabled}
          onValueChange={(enabled) => onToggleManageStock(!enabled)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={unlimitedStockEnabled ? colors.textOnPrimary : undefined}
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
            <Ionicons name="barcode-outline" size={24} color={colors.primary} />
          </View>

          <View style={styles.stockSummaryRow}>
            <View>
              <Text style={[styles.unitCount, { color: colors.text }]}>
                {fulfillmentCount} Units
              </Text>
              <Text
                style={[styles.helperText, { color: colors.textSecondary }]}
              >
                Needs {stockQuantity} identifiers
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Open fulfillment details"
              accessibilityRole="button"
              style={[
                styles.fulfillmentButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={onOpenFulfillmentModal}
            >
              <Text
                style={[
                  styles.fulfillmentButtonText,
                  { color: colors.textOnPrimary },
                ]}
              >
                {fulfillmentCount > 0 ? 'View/Edit Items' : 'Add Details'}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <ProductStockControls
            colors={colors}
            lowStockThreshold={lowStockThreshold}
            onLowStockThresholdChange={onLowStockThresholdChange}
            onStockAdjust={onStockAdjust}
            stockQuantity={stockQuantity}
          />
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
  stockSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 13,
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
