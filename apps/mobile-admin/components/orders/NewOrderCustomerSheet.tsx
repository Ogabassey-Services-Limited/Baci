import { Pressable, Text } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import { NewOrderCustomerCreateView } from './NewOrderCustomerCreateView';
import { NewOrderCustomerSearchView } from './NewOrderCustomerSearchView';

interface NewOrderCustomerSheetProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderCustomerSheet({
  controller,
}: NewOrderCustomerSheetProps) {
  const {
    colors,
    handleCloseCustomerModal,
    isCreatingCustomer,
    setIsCreatingCustomer,
    showCustomerModal,
  } = controller;

  return (
    <AppPageSheet
      closeLabel="Close customer sheet"
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 0, paddingTop: 0 }}
      onClose={handleCloseCustomerModal}
      scrollEnabled={false}
      title={isCreatingCustomer ? 'New Customer' : 'Select Customer'}
      trailingAccessory={
        isCreatingCustomer ? (
          <Pressable
            accessibilityLabel="Back to customer search"
            accessibilityRole="button"
            onPress={() => setIsCreatingCustomer(false)}
          >
            <Text style={{ color: colors.primary }}>Back to search</Text>
          </Pressable>
        ) : null
      }
      visible={showCustomerModal}
    >
      {isCreatingCustomer ? (
        <NewOrderCustomerCreateView controller={controller} />
      ) : (
        <NewOrderCustomerSearchView controller={controller} />
      )}
    </AppPageSheet>
  );
}
