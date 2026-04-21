import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';

interface FulfillmentItem {
  id: string;
  imei: string;
  serial_number: string;
}

interface ProductFulfillmentSheetProps {
  colors: Pick<
    ThemeColors,
    | 'border'
    | 'inputBg'
    | 'primary'
    | 'text'
    | 'textOnPrimary'
    | 'textSecondary'
  >;
  items: FulfillmentItem[];
  onClose: () => void;
  onDone: () => void;
  onItemChange: (
    index: number,
    field: 'imei' | 'serial_number',
    value: string
  ) => void;
  stockQuantity: number;
  visible: boolean;
}

export function ProductFulfillmentSheet({
  colors,
  items,
  onClose,
  onDone,
  onItemChange,
  visible,
}: ProductFulfillmentSheetProps) {
  return (
    <AppPageSheet
      footer={
        <Pressable
          accessibilityLabel="Done editing fulfillment details"
          accessibilityRole="button"
          onPress={onDone}
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.doneText, { color: colors.textOnPrimary }]}>
            Done
          </Text>
        </Pressable>
      }
      onClose={onClose}
      title="Fulfillment Details"
      visible={visible}
    >
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        Enter details for {items.length} units
      </Text>

      <View style={styles.items}>
        {items.map((item, index) => (
          <View
            key={item.id}
            style={[styles.itemCard, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.itemTitle, { color: colors.text }]}>
              Item #{index + 1}
            </Text>
            <TextInput
              accessibilityLabel={`IMEI for item ${index + 1}`}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numeric"
              maxLength={15}
              onChangeText={(value) => onItemChange(index, 'imei', value)}
              placeholder="Enter IMEI"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={item.imei}
            />
            <TextInput
              accessibilityLabel={`Serial number for item ${index + 1}`}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              onChangeText={(value) =>
                onItemChange(index, 'serial_number', value)
              }
              placeholder="Enter Serial Number"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={item.serial_number}
            />
          </View>
        ))}
      </View>
    </AppPageSheet>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: TYPOGRAPHY.size.md,
    marginBottom: SPACING.lg,
  },
  items: {
    gap: SPACING.lg,
  },
  itemCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  itemTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: TYPOGRAPHY.size.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  doneButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  doneText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
});
