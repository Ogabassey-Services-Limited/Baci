import { Stack, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import { ProductAttributesCard } from '@/components/product/ProductAttributesCard';
import { ProductBasicInformationCard } from '@/components/product/ProductBasicInformationCard';
import { ProductCategorySheet } from '@/components/product/ProductCategorySheet';
import { ProductFulfillmentSheet } from '@/components/product/ProductFulfillmentSheet';
import { ProductImageCard } from '@/components/product/ProductImageCard';
import { ProductInventoryCard } from '@/components/product/ProductInventoryCard';
import { ProductPricingCard } from '@/components/product/ProductPricingCard';
import { ProductStatusCard } from '@/components/product/ProductStatusCard';
import { ProductVariantsCard } from '@/components/product/ProductVariantsCard';
import { getCurrencySymbol } from '@/components/product/product-edit.helpers';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { InvalidRouteScreen } from '@/components/ui/InvalidRouteScreen';
import { useProductEditController } from '@/hooks/useProductEditController';
import { useTheme } from '@/hooks/useTheme';
import { createEmptyEditableVariant } from '@/lib/product-variant-form';

export default function ProductEditScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const controller = useProductEditController();

  if (!controller.id) {
    return (
      <InvalidRouteScreen
        title="Invalid Product"
        message="The product ID is invalid. Please check the link and try again."
      />
    );
  }

  if (controller.isMerchantLoading) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.background,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (controller.productError) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.background,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.text }}>Error loading product</Text>
        <Text style={{ color: colors.textSecondary }}>
          {controller.productError.message}
        </Text>
      </View>
    );
  }

  const currencySymbol = getCurrencySymbol(
    controller.merchant?.payout_currency
  );
  const isSaving =
    controller.updateProductMutation.isPending ||
    controller.createProductMutation.isPending;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => {
                void controller.handleSave();
              }}
              disabled={isSaving}
              style={({ pressed }) => ({
                alignItems: 'center',
                flexDirection: 'row',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              {isSaving ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginRight: 8 }}
                />
              ) : null}
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 17,
                  fontWeight: '600',
                }}
              >
                Save
              </Text>
            </Pressable>
          ),
        }}
      />

      <AppFormScreen
        contentContainerStyle={{ gap: 16, padding: 16 }}
        edges={['bottom']}
        style={{ backgroundColor: colors.background, flex: 1 }}
      >
        <ProductImageCard
          colors={colors}
          imageUrl={controller.formData.images[0]}
          isUploading={controller.isUploading}
          onPress={controller.handleImagePick}
        />

        <ProductStatusCard
          colors={colors}
          isPending={controller.updateStatusMutation.isPending}
          onValueChange={controller.handleStatusToggle}
          status={controller.formData.status}
        />

        <ProductBasicInformationCard
          categories={controller.categories}
          colors={colors}
          formData={{
            brand: controller.formData.brand,
            category: controller.formData.category,
            category_id: controller.formData.category_id,
            color: controller.formData.color,
            description: controller.formData.description,
            name: controller.formData.name,
            sku: controller.formData.sku,
          }}
          isEditing={controller.isEditing}
          onChange={controller.updateBasicInformation}
          onOpenCategoryModal={() => controller.setIsCategoryModalVisible(true)}
          onOpenProduct={(productId) => router.push(`/product/${productId}`)}
          productNameSuggestions={controller.productNameSuggestions}
        />

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
              Use structured variants for combinations like storage, RAM, or
              color. Orders and storefront selection will read these rows
              directly.
            </Text>
          </View>
          <Switch
            value={controller.formData.has_variants}
            onValueChange={(value) =>
              controller.setFormData((previous) => ({
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
              Platform.OS === 'ios'
                ? undefined
                : controller.formData.has_variants
                  ? colors.primary
                  : '#f4f3f4'
            }
          />
        </View>

        {controller.formData.has_variants ? (
          <ProductVariantsCard
            colors={colors}
            currencySymbol={currencySymbol}
            hasVariantConditionAxis={controller.hasVariantConditionAxis}
            onAddVariant={controller.addVariant}
            onAddVariantAttribute={controller.addVariantAttribute}
            onDefaultCostPriceChange={(cost_price) =>
              controller.setFormData((previous) => ({
                ...previous,
                cost_price,
              }))
            }
            onDefaultPriceChange={(price) =>
              controller.setFormData((previous) => ({ ...previous, price }))
            }
            onRemoveVariant={controller.removeVariant}
            onRemoveVariantAttribute={controller.removeVariantAttribute}
            onUpdateVariant={controller.updateVariant}
            onUpdateVariantAttribute={controller.updateVariantAttribute}
            onUpdateVariantCondition={controller.updateVariantCondition}
            value={{
              cost_price: controller.formData.cost_price,
              price: controller.formData.price,
            }}
            variants={controller.formData.variants}
          />
        ) : (
          <>
            <ProductAttributesCard
              attributes={controller.formData.variant_attributes}
              colors={colors}
              onAdd={controller.addAttribute}
              onRemove={controller.removeAttribute}
              onUpdate={controller.updateAttribute}
            />
            <ProductPricingCard
              colors={colors}
              costPrice={controller.formData.cost_price}
              currencySymbol={currencySymbol}
              onCostPriceChange={(cost_price) =>
                controller.setFormData((previous) => ({
                  ...previous,
                  cost_price,
                }))
              }
              onPriceChange={(price) =>
                controller.setFormData((previous) => ({ ...previous, price }))
              }
              price={controller.formData.price}
            />
            <ProductInventoryCard
              colors={colors}
              fulfillmentCount={
                controller.formData.fulfillment_details.items.length
              }
              lowStockThreshold={controller.formData.low_stock_threshold}
              manageStock={controller.formData.manage_stock}
              onLowStockThresholdChange={(low_stock_threshold) =>
                controller.setFormData((previous) => ({
                  ...previous,
                  low_stock_threshold,
                }))
              }
              onOpenFulfillmentModal={() =>
                controller.setIsFulfillmentModalVisible(true)
              }
              onStockAdjust={controller.adjustStock}
              onToggleManageStock={(manage_stock) =>
                controller.setFormData((previous) => ({
                  ...previous,
                  manage_stock,
                }))
              }
              stockQuantity={controller.formData.stock_quantity}
            />
          </>
        )}
      </AppFormScreen>

      <ProductCategorySheet
        categories={controller.categories}
        colors={colors}
        isCreating={controller.isCreatingCategory}
        isSubmittingNewCategory={controller.createCategoryMutation.isPending}
        newCategoryName={controller.newCategoryName}
        onClose={() => controller.setIsCategoryModalVisible(false)}
        onCreateCategory={controller.handleCreateCategory}
        onNewCategoryNameChange={controller.setNewCategoryName}
        onSelect={(category) => {
          controller.setFormData((previous) => ({
            ...previous,
            category: category.name,
            category_id: category.id,
          }));
          controller.setIsCategoryModalVisible(false);
        }}
        onToggleCreateMode={() =>
          controller.setIsCreatingCategory(!controller.isCreatingCategory)
        }
        selectedCategoryId={controller.formData.category_id}
        visible={controller.isCategoryModalVisible}
      />

      <ProductFulfillmentSheet
        colors={colors}
        items={controller.formData.fulfillment_details.items.map(
          (item, index) => ({
            ...item,
            id: `fulfillment-item-${index + 1}`,
          })
        )}
        onClose={() => controller.setIsFulfillmentModalVisible(false)}
        onDone={() => controller.setIsFulfillmentModalVisible(false)}
        onItemChange={controller.updateFulfillmentItem}
        stockQuantity={controller.formData.stock_quantity}
        visible={controller.isFulfillmentModalVisible}
      />
    </>
  );
}
