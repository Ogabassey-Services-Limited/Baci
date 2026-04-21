import { router, Stack } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { SuccessModal } from '@/components/ui/SuccessModal';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { NewOrderChannelSection } from './NewOrderChannelSection';
import { NewOrderCustomerSheet } from './NewOrderCustomerSheet';
import { NewOrderDetailsSection } from './NewOrderDetailsSection';
import { NewOrderEditItemSheet } from './NewOrderEditItemSheet';
import { NewOrderFinancialSheet } from './NewOrderFinancialSheet';
import { NewOrderFooterBar } from './NewOrderFooterBar';
import { NewOrderItemsSection } from './NewOrderItemsSection';
import { NewOrderNotesSection } from './NewOrderNotesSection';
import { NewOrderProductSheet } from './NewOrderProductSheet';
import { NewOrderQuickAddDialog } from './NewOrderQuickAddDialog';
import { styles } from './new-order.styles';

interface NewOrderScreenContentProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderScreenContent({
  controller,
}: NewOrderScreenContentProps) {
  const {
    colors,
    isSubmitting,
    lastOrderId,
    setCustomer,
    setDate,
    setDeliveryInfo,
    setDiscount,
    setIsVatApplied,
    setLastOrderId,
    setNotes,
    setOrderItems,
    setPartialAmount,
    setPaymentMethod,
    setPaymentStatus,
    setSameAsCustomer,
    setShippingFee,
    setShowSuccessModal,
    setTaxes,
    showSuccessModal,
  } = controller;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'New Sale',
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ paddingRight: 16 }}
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () =>
            isSubmitting ? <ActivityIndicator color={colors.primary} /> : null,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />

      <AppFormScreen
        edges={['bottom']}
        footer={<NewOrderFooterBar controller={controller} />}
        scrollEnabled={false}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <NewOrderDetailsSection controller={controller} />
          <NewOrderChannelSection controller={controller} />
          <NewOrderItemsSection controller={controller} />
          <NewOrderNotesSection controller={controller} />
          <View style={{ height: 100 }} />
        </ScrollView>
      </AppFormScreen>

      <NewOrderProductSheet controller={controller} />
      <NewOrderQuickAddDialog controller={controller} />
      <NewOrderCustomerSheet controller={controller} />
      <NewOrderFinancialSheet controller={controller} />
      <NewOrderEditItemSheet controller={controller} />

      <SuccessModal
        actionLabel="View Order Details"
        closeLabel="Create New Sale"
        message="The order has been successfully saved to your records."
        onActionPress={() => {
          setShowSuccessModal(false);
          if (lastOrderId) {
            router.replace(`/order/${lastOrderId}`);
          }
        }}
        onClose={() => {
          setShowSuccessModal(false);
          setOrderItems([]);
          setCustomer({
            address: '',
            email: '',
            id: null,
            name: '',
            phone: '',
          });
          setNotes('');
          setLastOrderId(null);
          // Reset financial fields so the next sale starts from zero
          setDiscount(0);
          setShippingFee(0);
          setTaxes(0);
          setIsVatApplied(false);
          // Reset delivery state to default
          setDeliveryInfo({
            address: '',
            city: '',
            name: '',
            phone: '',
            state: '',
          });
          setSameAsCustomer(true);
          // Reset payment fields
          setPaymentStatus('unpaid');
          setPaymentMethod('transfer');
          setPartialAmount('');
          // Reset the order date to now
          setDate(new Date());
        }}
        title="Sale Recorded!"
        visible={showSuccessModal}
      />
    </>
  );
}
