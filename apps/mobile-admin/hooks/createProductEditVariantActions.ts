import type { Dispatch, SetStateAction } from 'react';
import {
  createEmptyEditableVariant,
  createEmptyVariantAttribute,
  type EditableProductVariant,
  type VariantAttributeFormValue,
} from '@/lib/product-variant-form';
import type { EditableProductCondition } from '@/lib/product-condition';
import type { ProductEditFormData } from '@/components/product/product-edit.types';

interface CreateProductEditVariantActionsParams {
  formData: ProductEditFormData;
  setFormData: Dispatch<SetStateAction<ProductEditFormData>>;
}

export function createProductEditVariantActions({
  formData,
  setFormData,
}: CreateProductEditVariantActionsParams) {
  const adjustStock = (nextQuantity: number) => {
    const nextStock = Math.max(0, nextQuantity);
    const currentItems = formData.fulfillment_details.items || [];
    let nextItems = [...currentItems];

    if (nextStock > currentItems.length) {
      nextItems = [
        ...nextItems,
        ...Array.from({ length: nextStock - currentItems.length }, () => ({
          imei: '',
          serial_number: '',
        })),
      ];
    } else if (nextStock < currentItems.length) {
      nextItems = nextItems.slice(0, nextStock);
    }

    setFormData((previous) => ({
      ...previous,
      fulfillment_details: { items: nextItems },
      stock_quantity: nextStock,
    }));
  };

  const updateFulfillmentItem = (
    index: number,
    field: 'imei' | 'serial_number',
    value: string
  ) => {
    const nextItems = [...(formData.fulfillment_details.items || [])];
    if (!nextItems[index]) {
      nextItems[index] = { imei: '', serial_number: '' };
    }
    nextItems[index] = { ...nextItems[index], [field]: value };
    setFormData((previous) => ({
      ...previous,
      fulfillment_details: { items: nextItems },
    }));
  };

  const addAttribute = () => {
    setFormData((previous) => ({
      ...previous,
      variant_attributes: [...previous.variant_attributes, { key: '', value: '' }],
    }));
  };

  const updateAttribute = (index: number, field: 'key' | 'value', text: string) => {
    const nextAttributes = [...formData.variant_attributes];
    nextAttributes[index] = { ...nextAttributes[index], [field]: text };
    setFormData((previous) => ({ ...previous, variant_attributes: nextAttributes }));
  };

  const removeAttribute = (index: number) => {
    const nextAttributes = [...formData.variant_attributes];
    nextAttributes.splice(index, 1);
    setFormData((previous) => ({ ...previous, variant_attributes: nextAttributes }));
  };

  const updateVariant = (
    index: number,
    updates: Partial<EditableProductVariant>
  ) => {
    const nextVariants = [...formData.variants];
    nextVariants[index] = { ...nextVariants[index], ...updates };
    setFormData((previous) => ({ ...previous, variants: nextVariants }));
  };

  const addVariant = () => {
    const attributeKeys = Array.from(
      new Set(
        formData.variants
          .flatMap((variant) => variant.attributes.map((attribute) => attribute.key.trim()))
          .filter(Boolean)
      )
    );

    setFormData((previous) => ({
      ...previous,
      has_variants: true,
      variants: [
        ...previous.variants,
        createEmptyEditableVariant({
          attributeKeys,
          condition: previous.variants.find((variant) => variant.condition)?.condition,
          costPrice: previous.cost_price,
          images: previous.images,
          price: previous.price,
        }),
      ],
    }));
  };

  const removeVariant = (index: number) => {
    const nextVariants = [...formData.variants];
    nextVariants.splice(index, 1);
    setFormData((previous) => ({ ...previous, variants: nextVariants }));
  };

  const updateVariantAttribute = (
    variantIndex: number,
    attributeIndex: number,
    field: keyof VariantAttributeFormValue,
    value: string
  ) => {
    const nextAttributes = [...formData.variants[variantIndex].attributes];
    nextAttributes[attributeIndex] = {
      ...nextAttributes[attributeIndex],
      [field]: value,
    };
    updateVariant(variantIndex, { attributes: nextAttributes });
  };

  const addVariantAttribute = (variantIndex: number) => {
    updateVariant(variantIndex, {
      attributes: [
        ...formData.variants[variantIndex].attributes,
        createEmptyVariantAttribute(),
      ],
    });
  };

  const removeVariantAttribute = (variantIndex: number, attributeIndex: number) => {
    const nextAttributes = [...formData.variants[variantIndex].attributes];
    nextAttributes.splice(attributeIndex, 1);
    updateVariant(variantIndex, { attributes: nextAttributes });
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
