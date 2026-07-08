import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { SheetTextInputRef } from '@/components/ui/SheetTextInput';
import type { NewOrderController } from '@/hooks/useNewOrderController';
import {
  getProductPickerRowSubtitle,
  getProductPickerRowTitle,
} from '@/lib/order-product-picker';
import type { AdminProductVariant } from '@/lib/product-picker-variant-rows';
import { buildVariantOptionGroups } from '@/lib/product-variant-option-selector';
import { NewOrderCreateProductRow } from './NewOrderCreateProductRow';
import { NewOrderProductPickerSheetFrame } from './NewOrderProductPickerSheetFrame';
import { NewOrderProductSearchFooter } from './NewOrderProductSearchFooter';
import { NewOrderProductSheetEmptyState } from './NewOrderProductSheetEmptyState';
import { MODAL_FLATLIST_PROPS } from './new-order.shared';
import { styles } from './new-order.styles';
import { ProductVariantOptionSelector } from './ProductVariantOptionSelector';

const PRODUCT_PICKER_FOOTER_BOTTOM_INSET = 18;
const PRODUCT_PICKER_LIST_BOTTOM_PADDING = 128;
const PRODUCT_PICKER_ROW_HEIGHT = 64;
const PRODUCT_PICKER_VARIANT_ROW_HEIGHT = 72;
export const PRODUCT_SEARCH_FOCUS_DELAY_MS = 250;

export type NewOrderProductSheetController = Pick<
  NewOrderController,
  | 'closeProductModal'
  | 'colors'
  | 'fetchMoreProducts'
  | 'formatPrice'
  | 'handleAddProduct'
  | 'handleSelectProduct'
  | 'hasMoreProducts'
  | 'isFetchingMoreProducts'
  | 'isLoadingSelectedParentProduct'
  | 'isPickingVariant'
  | 'isProductsLoading'
  | 'productSearch'
  | 'productsError'
  | 'refetchProducts'
  | 'refetchSelectedParentProduct'
  | 'resetProductPickerState'
  | 'selectableProductRows'
  | 'selectedParentProduct'
  | 'selectedParentProductError'
  | 'setProductSearch'
  | 'showProductModal'
>;

export function NewOrderProductSheet({
  controller,
}: {
  controller: NewOrderProductSheetController;
}) {
  const inputRef = useRef<SheetTextInputRef | null | undefined>(null);

  const {
    closeProductModal,
    colors,
    fetchMoreProducts,
    formatPrice,
    handleAddProduct,
    handleSelectProduct,
    hasMoreProducts,
    isFetchingMoreProducts,
    isPickingVariant,
    productSearch,
    resetProductPickerState,
    selectableProductRows,
    selectedParentProduct,
    setProductSearch,
    showProductModal,
  } = controller;
  const productSearchFooter = !isPickingVariant ? (
    <NewOrderProductSearchFooter
      colors={colors}
      inputRef={inputRef}
      productSearch={productSearch}
      setProductSearch={setProductSearch}
    />
  ) : null;
  const structuredVariantRows: AdminProductVariant[] =
    isPickingVariant && selectedParentProduct
      ? selectableProductRows.map(
          (row): AdminProductVariant => ({
            ...row,
            cost_price: null,
            images: row.images ?? [],
            parent_product_id:
              row.parent_product_id ?? selectedParentProduct.id ?? null,
            primary_image: row.images?.[0] ?? null,
            source: 'structured',
            stock_quantity: 0,
          })
        )
      : [];
  const variantOptionGroups =
    structuredVariantRows.length > 0
      ? buildVariantOptionGroups(structuredVariantRows, {})
      : [];
  const showProductFirstVariantSelector = Boolean(
    isPickingVariant &&
      selectedParentProduct &&
      variantOptionGroups.some((group) => group.values.length > 1)
  );
  const productPickerRowHeight = isPickingVariant
    ? PRODUCT_PICKER_VARIANT_ROW_HEIGHT
    : PRODUCT_PICKER_ROW_HEIGHT;

  useEffect(() => {
    if (showProductModal && !isPickingVariant) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, PRODUCT_SEARCH_FOCUS_DELAY_MS);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [showProductModal, isPickingVariant]);

  return (
    <NewOrderProductPickerSheetFrame
      closeLabel="Close product sheet"
      colors={colors}
      footer={productSearchFooter}
      footerBottomInset={PRODUCT_PICKER_FOOTER_BOTTOM_INSET}
      leadingAccessory={
        isPickingVariant ? (
          <Pressable
            accessibilityLabel="Back to product list"
            accessibilityRole="button"
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            onPress={resetProductPickerState}
          >
            <Ionicons color={colors.text} name="chevron-back" size={24} />
          </Pressable>
        ) : null
      }
      onClose={closeProductModal}
      title={isPickingVariant ? 'Choose Variant' : 'Select Item'}
      trailingAccessory={
        isPickingVariant ? (
          <Pressable
            accessibilityLabel="Close product sheet"
            accessibilityRole="button"
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            onPress={closeProductModal}
            style={{
              alignItems: 'center',
              backgroundColor: `${colors.text}10`,
              borderRadius: 999,
              height: 36,
              justifyContent: 'center',
              width: 36,
            }}
          >
            <Ionicons color={colors.text} name="close" size={22} />
          </Pressable>
        ) : null
      }
      visible={showProductModal}
    >
      <View style={{ flex: 1 }}>
        {selectedParentProduct && !showProductFirstVariantSelector ? (
          <Text
            numberOfLines={1}
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginBottom: 12,
              paddingHorizontal: 16,
            }}
          >
            {selectedParentProduct.name}
          </Text>
        ) : null}

        {!isPickingVariant ? (
          <NewOrderCreateProductRow
            colors={colors}
            onPress={() => {
              closeProductModal();
              router.push('/product/new');
            }}
          />
        ) : null}

        {showProductFirstVariantSelector && selectedParentProduct ? (
          <ProductVariantOptionSelector
            colors={colors}
            formatPrice={formatPrice}
            onAddProduct={handleAddProduct}
            parentProduct={selectedParentProduct}
            variantOptionGroups={variantOptionGroups}
            variants={structuredVariantRows}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <BottomSheetFlatList
              getItemLayout={(_data, index) => ({
                index,
                length: productPickerRowHeight,
                offset: productPickerRowHeight * index,
              })}
              {...MODAL_FLATLIST_PROPS}
              contentContainerStyle={{
                paddingBottom: PRODUCT_PICKER_LIST_BOTTOM_PADDING,
              }}
              data={selectableProductRows}
              keyExtractor={(item) => item.id}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <NewOrderProductSheetEmptyState controller={controller} />
              }
              ListFooterComponent={
                !isPickingVariant && isFetchingMoreProducts ? (
                  <ActivityIndicator
                    color={colors.primary}
                    size="small"
                    style={{ paddingVertical: 16 }}
                  />
                ) : null
              }
              onEndReached={() => {
                if (
                  !isPickingVariant &&
                  hasMoreProducts &&
                  !isFetchingMoreProducts
                ) {
                  void fetchMoreProducts();
                }
              }}
              onEndReachedThreshold={0.4}
              renderItem={({ item }) => {
                const pickerTitle = getProductPickerRowTitle(
                  item,
                  selectedParentProduct?.name
                );
                const pickerSubtitle = getProductPickerRowSubtitle(item);
                const showPickerSubtitle =
                  isPickingVariant && pickerSubtitle !== 'N/A';

                return (
                  <Pressable
                    accessibilityLabel={
                      isPickingVariant
                        ? `Add ${pickerTitle}`
                        : `Select ${pickerTitle}`
                    }
                    accessibilityRole="button"
                    onPress={() =>
                      isPickingVariant
                        ? handleAddProduct({
                            ...item,
                            images:
                              item.images?.length > 0
                                ? item.images
                                : (selectedParentProduct?.images ?? []),
                            parent_product_id:
                              item.parent_product_id ??
                              selectedParentProduct?.id ??
                              null,
                          })
                        : handleSelectProduct(item)
                    }
                    style={[
                      styles.productItem,
                      {
                        borderBottomColor: colors.border,
                        height: productPickerRowHeight,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.text, fontSize: 16 }}
                      >
                        {pickerTitle}
                      </Text>
                      {showPickerSubtitle ? (
                        <Text
                          numberOfLines={1}
                          style={{ color: colors.textSecondary, fontSize: 12 }}
                        >
                          {pickerSubtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.text, fontWeight: '500' }}>
                      {formatPrice(item.price)}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}
      </View>
    </NewOrderProductPickerSheetFrame>
  );
}
