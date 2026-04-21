import * as Crypto from 'expo-crypto';
import type { Dispatch, SetStateAction } from 'react';
import type { ProductEditFormData } from '@/components/product/product-edit.types';
import type { EditableProductCondition } from '@/lib/product-condition';
import {
  createEmptyEditableVariant,
  createEmptyVariantAttribute,
  type EditableProductVariant,
  type VariantAttributeFormValue,
} from '@/lib/product-variant-form';

interface CreateProductEditVariantActionsParams {
  formData: ProductEditFormData;
  setFormData: Dispatch<SetStateAction<ProductEditFormData>>;
}

function createFulfillmentItemDraft() {
  return {
    id: Crypto.randomUUID(),
    imei: '',
    serial_number: '',
  };
}

function createProductVariantAttributeDraft() {
  return {
    id: Crypto.randomUUID(),
    key: '',
    value: '',
  };
}

export function createProductEditVariantActions({
  // formData kept on the params interface for backward compatibility with callers.
  // All handlers read from the setFormData callback's previous state to avoid
  // stale closure reads when multiple updates happen in the same render cycle.
  formData: _formData,
  setFormData,
}: CreateProductEditVariantActionsParams) {
  const adjustStock = (nextQuantity: number) => {
    const nextStock = Math.max(0, nextQuantity);

    setFormData((previous) => {
      const currentItems = previous.fulfillment_details.items || [];
      let nextItems = [...currentItems];

      if (nextStock > currentItems.length) {
        nextItems = [
          ...nextItems,
          ...Array.from(
            { length: nextStock - currentItems.length },
            createFulfillmentItemDraft
          ),
        ];
      } else if (nextStock < currentItems.length) {
        nextItems = nextItems.slice(0, nextStock);
      }

      return {
        ...previous,
        fulfillment_details: { items: nextItems },
        stock_quantity: nextStock,
      };
    });
  };

  const updateFulfillmentItem = (
    itemId: string,
    field: 'imei' | 'serial_number',
    value: string
  ) => {
    setFormData((previous) => {
      const nextItems = [...(previous.fulfillment_details.items || [])];
      const itemIndex = nextItems.findIndex((item) => item.id === itemId);
      if (itemIndex === -1) {
        return previous;
      }
      nextItems[itemIndex] = { ...nextItems[itemIndex], [field]: value };
      return {
        ...previous,
        fulfillment_details: { items: nextItems },
      };
    });
  };

  const addAttribute = () => {
    setFormData((previous) => ({
      ...previous,
      variant_attributes: [
        ...previous.variant_attributes,
        createProductVariantAttributeDraft(),
      ],
    }));
  };

  const updateAttribute = (
    index: number,
    field: 'key' | 'value',
    text: string
  ) => {
    setFormData((previous) => {
      const nextAttributes = [...previous.variant_attributes];
      nextAttributes[index] = { ...nextAttributes[index], [field]: text };
      return { ...previous, variant_attributes: nextAttributes };
    });
  };

  const removeAttribute = (index: number) => {
    setFormData((previous) => {
      const nextAttributes = [...previous.variant_attributes];
      nextAttributes.splice(index, 1);
      return { ...previous, variant_attributes: nextAttributes };
    });
  };

  const updateVariant = (
    index: number,
    updates: Partial<EditableProductVariant>
  ) => {
    setFormData((previous) => {
      const nextVariants = [...previous.variants];
      nextVariants[index] = { ...nextVariants[index], ...updates };
      return { ...previous, variants: nextVariants };
    });
  };

  const addVariant = () => {
    setFormData((previous) => {
      const attributeKeys = Array.from(
        new Set(
          previous.variants
            .flatMap((variant) =>
              variant.attributes.map((attribute) => attribute.key.trim())
            )
            .filter(Boolean)
        )
      );

      return {
        ...previous,
        has_variants: true,
        variants: [
          ...previous.variants,
          createEmptyEditableVariant({
            attributeKeys,
            condition: previous.variants.find((variant) => variant.condition)
              ?.condition,
            costPrice: previous.cost_price,
            images: previous.images,
            price: previous.price,
          }),
        ],
      };
    });
  };

  const removeVariant = (index: number) => {
    setFormData((previous) => {
      const nextVariants = [...previous.variants];
      nextVariants.splice(index, 1);
      return { ...previous, variants: nextVariants };
    });
  };

  const updateVariantAttribute = (
    variantIndex: number,
    attributeIndex: number,
    field: keyof VariantAttributeFormValue,
    value: string
  ) => {
    setFormData((previous) => {
      const nextVariants = [...previous.variants];
      const currentVariant = nextVariants[variantIndex];
      if (!currentVariant) {
        return previous;
      }
      const nextAttributes = [...currentVariant.attributes];
      nextAttributes[attributeIndex] = {
        ...nextAttributes[attributeIndex],
        [field]: value,
      };
      nextVariants[variantIndex] = {
        ...currentVariant,
        attributes: nextAttributes,
      };
      return { ...previous, variants: nextVariants };
    });
  };

  const addVariantAttribute = (variantIndex: number) => {
    setFormData((previous) => {
      const nextVariants = [...previous.variants];
      const currentVariant = nextVariants[variantIndex];
      if (!currentVariant) {
        return previous;
      }
      nextVariants[variantIndex] = {
        ...currentVariant,
        attributes: [
          ...currentVariant.attributes,
          createEmptyVariantAttribute(),
        ],
      };
      return { ...previous, variants: nextVariants };
    });
  };

  const removeVariantAttribute = (
    variantIndex: number,
    attributeIndex: number
  ) => {
    setFormData((previous) => {
      const nextVariants = [...previous.variants];
      const currentVariant = nextVariants[variantIndex];
      if (!currentVariant) {
        return previous;
      }
      const nextAttributes = [...currentVariant.attributes];
      nextAttributes.splice(attributeIndex, 1);
      nextVariants[variantIndex] = {
        ...currentVariant,
        attributes: nextAttributes,
      };
      return { ...previous, variants: nextVariants };
    });
  };

  const updateVariantCondition = (
    variantIndex: number,
    condition?: EditableProductCondition
  ) => {
    updateVariant(variantIndex, { condition });
  };

  return {
    addAttribute,
    addVariant,
    addVariantAttribute,
    adjustStock,
    removeAttribute,
    removeVariant,
    removeVariantAttribute,
    updateAttribute,
    updateFulfillmentItem,
    updateVariant,
    updateVariantAttribute,
    updateVariantCondition,
  };
}
