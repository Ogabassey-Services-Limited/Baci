import { Pressable, Text, View } from 'react-native';
import { ConditionSelector } from '@/components/product/ConditionSelector';
import { VariantSelector } from '@/components/product/VariantSelector';
import type Colors from '@/constants/Colors';
import type { Product, ProductCondition } from '@/types/product';
import { productDetailsBodyStyles as styles } from './ProductDetailsBody.styles';

type ColorsScheme = (typeof Colors)['light'];

interface ProductDetailsVariantSectionProps {
  availableConditions: ProductCondition[];
  canShowVariantSelector: boolean;
  colors: ColorsScheme;
  conditionOffers: NonNullable<Product['offers']>;
  hasPriceDrivingVariantAxes: boolean;
  mergedVariantAttributes: Record<string, string[]> | undefined;
  onSelectAttribute: (axis: string, value: string) => void;
  onSelectColor: (color: string, imgs?: string[]) => void;
  onSelectStorage: (storage: string) => void;
  product: Product;
  selectedAttributes: Record<string, string>;
  selectedColor: string | null;
  selectedCondition: ProductCondition | null;
  selectedStorage: string | null;
  selectedVariant: string | null;
  setSelectedCondition: (c: ProductCondition) => void;
  setSelectedVariant: (id: string) => void;
}

export function ProductDetailsVariantSection({
  availableConditions,
  canShowVariantSelector,
  colors,
  conditionOffers,
  hasPriceDrivingVariantAxes,
  mergedVariantAttributes,
  onSelectAttribute,
  onSelectColor,
  onSelectStorage,
  product,
  selectedAttributes,
  selectedColor,
  selectedCondition,
  selectedStorage,
  selectedVariant,
  setSelectedCondition,
  setSelectedVariant,
}: ProductDetailsVariantSectionProps) {
  const showLegacyVariants =
    product.variants &&
    product.variants.length > 0 &&
    !product.colors &&
    !product.color_images &&
    !product.variants.some((v) => v.attributes?.storage);

  return (
    <>
      {availableConditions.length > 1 && (
        <ConditionSelector
          currentCondition={product.condition}
          offers={conditionOffers}
          availableConditions={availableConditions}
          selectedCondition={selectedCondition}
          onSelect={setSelectedCondition}
          basePrice={product.price}
          showPrices={!product.has_variants || !hasPriceDrivingVariantAxes}
        />
      )}

      {canShowVariantSelector && (
        <View style={styles.section}>
          <VariantSelector
            attributes={mergedVariantAttributes}
            colors={product.colors}
            colorImages={product.color_images}
            storage={mergedVariantAttributes?.storage}
            variants={product.variants}
            manageStock={product.manage_stock}
            selectedAttributes={selectedAttributes}
            selectedColor={selectedColor}
            selectedStorage={selectedStorage}
            onSelectAttribute={onSelectAttribute}
            onSelectColor={onSelectColor}
            onSelectStorage={onSelectStorage}
          />
        </View>
      )}

      {showLegacyVariants && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Options
          </Text>
          <View style={styles.variantGrid}>
            {product.variants?.map((variant) => (
              <Pressable
                key={variant.id}
                onPress={() => setSelectedVariant(variant.id)}
                style={[
                  styles.variantChip,
                  {
                    borderColor:
                      selectedVariant === variant.id
                        ? colors.primary
                        : colors.border,
                  },
                  selectedVariant === variant.id && {
                    backgroundColor: colors.primaryLowOpacity,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.variantLabel,
                    {
                      color:
                        selectedVariant === variant.id
                          ? colors.primary
                          : colors.text,
                    },
                  ]}
                >
                  {variant.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );
}
