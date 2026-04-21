import type { Dispatch, SetStateAction } from 'react';
import { Switch, Text, View } from 'react-native';
import type { ProductEditFormData } from '@/components/product/product-edit.types';
import type { ThemeColors } from '@/constants/theme';
import { createEmptyEditableVariant } from '@/lib/product-variant-form';

const SWITCH_THUMB_OFF = 'border' as const;

interface ProductHasVariantsToggleCardProps {
  colors: ThemeColors;
  formData: ProductEditFormData;
  setFormData: Dispatch<SetStateAction<ProductEditFormData>>;
}

export function ProductHasVariantsToggleCard({
  colors,
  formData,
  setFormData,
}: ProductHasVariantsToggleCardProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
      }}
    >
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 16,
            fontWeight: '700',
            marginBottom: 4,
          }}
        >
          This Product Has Variants
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Use structured variants for combinations like storage, RAM, or color.
          Orders and storefront selection will read these rows directly.
        </Text>
      </View>
      <Switch
        accessibilityHint="Enables structured variants for combinations like storage, RAM, or color."
        accessibilityLabel="Has variants"
        accessibilityRole="switch"
        value={formData.has_variants}
        onValueChange={(value) =>
          setFormData((previous) => ({
            ...previous,
            has_variants: value,
            manage_stock: value ? true : previous.manage_stock,
            variants:
              value && previous.variants.length === 0
                ? [
                    createEmptyEditableVariant({
                      costPrice: previous.cost_price,
                      images: previous.images,
                      price: previous.price,
                    }),
                  ]
                : previous.variants,
          }))
        }
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={
          formData.has_variants ? colors.primary : colors[SWITCH_THUMB_OFF]
        }
      />
    </View>
  );
}
