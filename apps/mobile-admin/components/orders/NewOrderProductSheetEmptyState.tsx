import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';

interface NewOrderProductSheetEmptyStateProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderProductSheetEmptyState({
  controller,
}: NewOrderProductSheetEmptyStateProps) {
  const {
    colors,
    isLoadingSelectedParentProduct,
    isPickingVariant,
    isProductsLoading,
    productSearch,
    productsError,
    refetchProducts,
    refetchSelectedParentProduct,
    selectedParentProductError,
  } = controller;

  if (isPickingVariant && selectedParentProductError) {
    return (
      <NewOrderRetryState
        colors={colors}
        message={
          selectedParentProductError instanceof Error
            ? selectedParentProductError.message
            : 'Unable to load variants right now.'
        }
        onRetry={() => {
          void refetchSelectedParentProduct();
        }}
      />
    );
  }

  if (isPickingVariant && isLoadingSelectedParentProduct) {
    return (
      <ActivityIndicator
        color={colors.primary}
        size="large"
        style={{ paddingVertical: 32 }}
      />
    );
  }

  if (isPickingVariant) {
    return (
      <View style={{ padding: 20 }}>
        <Text
          style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}
        >
          No sellable variants are available for this product yet.
        </Text>
      </View>
    );
  }

  if (productsError) {
    return (
      <NewOrderRetryState
        colors={colors}
        message={
          productsError instanceof Error
            ? productsError.message
            : 'Unable to load products right now.'
        }
        onRetry={() => {
          void refetchProducts();
        }}
      />
    );
  }

  if (isProductsLoading) {
    return (
      <ActivityIndicator
        color={colors.primary}
        size="large"
        style={{ paddingVertical: 32 }}
      />
    );
  }

  return (
    <View style={{ padding: 20 }}>
      <Text
        style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}
      >
        {productSearch.trim()
          ? 'No products match that search yet.'
          : 'No products available yet.'}
      </Text>
    </View>
  );
}

function NewOrderRetryState({
  colors,
  message,
  onRetry,
}: {
  colors: ReturnType<typeof useNewOrderController>['colors'];
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 12, padding: 20 }}>
      <Text
        style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}
      >
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 10,
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Text
          style={{ color: colors.background, fontSize: 14, fontWeight: '600' }}
        >
          Retry
        </Text>
      </Pressable>
    </View>
  );
}
