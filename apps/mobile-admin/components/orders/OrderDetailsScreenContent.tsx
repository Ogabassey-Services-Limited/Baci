import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { OrderItemDetailModal } from '@/components/orders/OrderItemDetailModal';
import { OrderPaymentOptionDialog } from '@/components/orders/OrderPaymentOptionDialog';
import { OrderStatusSheet } from '@/components/orders/OrderStatusSheet';
import { RecordPaymentSheet } from '@/components/orders/RecordPaymentSheet';
import { ShipmentFlowSheet } from '@/components/orders/ShipmentFlowSheet';
import { ShipOnCreditDialog } from '@/components/orders/ShipOnCreditDialog';
import { ReceiptPreviewModal } from '@/components/ui/ReceiptPreviewModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import type { useOrderDetailsController } from '@/hooks/useOrderDetailsController';
import { OrderDetailsFooterBar } from './OrderDetailsFooterBar';
import { OrderDetailsItemsAndPaymentSection } from './OrderDetailsItemsAndPaymentSection';
import { OrderDetailsOverviewSection } from './OrderDetailsOverviewSection';
import { OrderDetailsShippingSection } from './OrderDetailsShippingSection';

interface OrderDetailsScreenContentProps {
  controller: ReturnType<typeof useOrderDetailsController>;
}

export function OrderDetailsScreenContent({
  controller,
}: OrderDetailsScreenContentProps) {
  const order = controller.order;

  if (!order) {
    return null;
  }

  return (
    <View style={{ backgroundColor: controller.colors.background, flex: 1 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: order.order_number,
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: controller.colors.background },
          headerTintColor: controller.colors.text,
          headerRight: () => (
            <Pressable
              accessibilityLabel="Share order"
              accessibilityRole="button"
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              onPress={() => {
                void controller.handleShare();
              }}
              style={{ padding: 4 }}
            >
              <Ionicons
                name="share-outline"
                size={24}
                color={controller.colors.primary}
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <OrderDetailsOverviewSection
          colors={controller.colors}
          createdAtLabel={controller.formatDate(order.created_at)}
          customerEmail={order.customer_email}
          customerName={order.customer_name}
          customerPhone={order.customer_phone}
          isGeneratingReceipt={controller.isGeneratingReceipt}
          onCall={controller.handleCall}
          onEmail={controller.handleEmail}
          onSendOrderDetailsToRider={() => {
            void controller.handleSendOrderDetailsToRider();
          }}
          onSendReceipt={() => {
            void controller.handleSendReceipt();
          }}
          onSendRiderToCustomer={controller.handleSendRiderToCustomer}
          onWhatsApp={controller.handleWhatsApp}
          recordedByName={order.recorded_by_name}
          shippingColor={controller.shippingColor}
          shippingConfig={{
            icon: controller.shippingConfig.icon,
            label: controller.shippingConfig.label,
          }}
          shippingStatus={order.shipping_status}
          showPostShipmentActions={controller.showPostShipmentActions}
          source={order.source}
          sourceInfo={controller.sourceInfo}
          updatedAtLabel={controller.formatDate(order.updated_at)}
        />

        <OrderDetailsItemsAndPaymentSection
          amountPaid={Number(order.amount_paid) || 0}
          balance={order.balance}
          colors={controller.colors}
          discountAmount={order.discount_amount}
          formatPrice={controller.formatPrice}
          items={order.items || []}
          onRecordPayment={() => {
            const amount = Math.round(order.balance ?? order.total);
            if (amount > 0) {
              controller.setPaymentAmount(String(amount));
              controller.setShowRecordPaymentModal(true);
            }
          }}
          onRequestPayment={() => {
            void controller.handleSendReminder();
          }}
          onSelectItem={(item) =>
            controller.setSelectedOrderItem({
              ...item,
              product_id: item.product_id ?? undefined,
            })
          }
          paymentColor={controller.paymentColor}
          paymentLabel={controller.paymentConfig.label}
          paymentMethod={order.payment_method}
          paymentStatus={order.payment_status}
          shippingFee={order.shipping_fee}
          subtotal={order.subtotal}
          total={order.total}
        />

        <OrderDetailsShippingSection
          address={controller.formatAddress(order.shipping_address)}
          colors={controller.colors}
        />
      </ScrollView>

      <OrderDetailsFooterBar
        colors={controller.colors}
        currentStatusLabel={controller.shippingConfig.label}
        onPress={() => controller.setShowStatusModal(true)}
        statusColor={controller.shippingColor}
      />

      <OrderStatusSheet
        colors={controller.colors}
        onClose={() => controller.setShowStatusModal(false)}
        onSelectStatus={(status) => {
          void controller.handleStatusUpdate(status);
        }}
        shippingStatus={order.shipping_status}
        visible={controller.showStatusModal}
      />

      <ShipOnCreditDialog
        colors={controller.colors}
        creditNotes={controller.creditNotes}
        isSubmitting={controller.shipOnCreditMutation.isPending}
        onClose={() => controller.setShowCreditModal(false)}
        onConfirm={() => {
          void controller.handleShipOnCredit();
        }}
        onCreditNotesChange={controller.setCreditNotes}
        visible={controller.showCreditModal}
      />

      <ShipmentFlowSheet
        canUseProvider={controller.providerBookingAvailable}
        fulfillmentDetails={controller.fulfillmentDetails}
        hasExistingFulfillment={Boolean(
          order.fulfillment_details?.imei ||
            order.fulfillment_details?.serialNumber
        )}
        isSubmitting={controller.isShipmentSubmitting}
        onClose={controller.closeShipmentFlow}
        onContinueFromDetails={controller.proceedFromFulfillmentDetails}
        onContinueFromMethod={() => {
          void controller.proceedFromShipmentMethod();
        }}
        onConfirmSelfFulfillment={() => {
          void controller.handleSubmitSelfFulfillment();
        }}
        onFulfillmentDetailsChange={(field, value) =>
          controller.setFulfillmentDetails((previous) => ({
            ...previous,
            [field]: value,
          }))
        }
        onModeChange={controller.setPendingShipmentMode}
        onRiderPhoneChange={controller.setRiderPhone}
        onSelectSavedRider={controller.setRiderPhone}
        onStepBack={controller.handleShipmentFlowBack}
        orderNumber={order.order_number}
        providerLabel={controller.providerLabel}
        requiresFulfillment={controller.requiresShipmentDetails}
        riderPhone={controller.riderPhone}
        savedRiders={controller.savedRiders}
        selectedMode={controller.pendingShipmentMode}
        step={controller.shipmentFlowStep}
        visible={controller.showShipmentFlow}
      />

      <OrderPaymentOptionDialog
        balanceLabel={controller.formatPrice(order.balance ?? order.total)}
        colors={controller.colors}
        onClose={() => controller.setShowPaymentOptionModal(false)}
        onRecordPayment={() => {
          controller.setShowPaymentOptionModal(false);
          const amount = Math.round(order.balance ?? order.total);
          if (amount > 0) {
            controller.setPaymentAmount(String(amount));
            controller.setShowRecordPaymentModal(true);
          }
        }}
        onShipOnCredit={() => {
          controller.setShowPaymentOptionModal(false);
          controller.setShowCreditModal(true);
        }}
        visible={controller.showPaymentOptionModal}
      />

      <RecordPaymentSheet
        colors={controller.colors}
        currencySymbol={controller.currencySymbol}
        isConfirmDisabled={
          !controller.paymentMethod || !controller.paymentAmount
        }
        isSubmitting={controller.recordPaymentMutation.isPending}
        onAmountChange={controller.handlePaymentAmountChange}
        onClose={() => controller.setShowRecordPaymentModal(false)}
        onConfirm={() => {
          void controller.handleRecordPayment();
        }}
        onMethodChange={controller.setPaymentMethod}
        onNotesChange={controller.setPaymentNotes}
        paymentAmount={controller.paymentAmount}
        paymentMethod={controller.paymentMethod}
        paymentNotes={controller.paymentNotes}
        visible={controller.showRecordPaymentModal}
      />

      <SuccessModal
        visible={controller.successModal.visible}
        title={controller.successModal.title}
        message={controller.successModal.message}
        subMessage={controller.successModal.subMessage}
        actionIcon={
          controller.successModal.showAction ? 'logo-whatsapp' : undefined
        }
        actionLabel={
          controller.successModal.showAction
            ? controller.successModal.actionLabel
            : undefined
        }
        actionVariant={controller.successModal.actionVariant}
        onActionPress={
          controller.successModal.showAction
            ? () => {
                controller.setSuccessModal((previous) => ({
                  ...previous,
                  visible: false,
                }));
                void controller.handleSendOrderDetailsToRider();
              }
            : undefined
        }
        onClose={() =>
          controller.setSuccessModal((previous) => ({
            ...previous,
            visible: false,
            showAction: false,
            actionLabel: '',
            actionVariant: 'default',
          }))
        }
        closeLabel="Done"
      />

      <ReceiptPreviewModal
        visible={controller.showReceiptPreview}
        html={controller.receiptHtml}
        onClose={() => controller.setShowReceiptPreview(false)}
        onShare={() => {
          void controller.handleShareReceiptPdf();
        }}
        isPaid={order.payment_status === 'paid'}
      />

      <OrderItemDetailModal
        visible={controller.selectedOrderItem !== null}
        item={controller.selectedOrderItem}
        formattedUnitPrice={
          controller.selectedOrderItem
            ? controller.formatPrice(controller.selectedOrderItem.price)
            : ''
        }
        formattedLineTotal={
          controller.selectedOrderItem
            ? controller.formatPrice(
                controller.selectedOrderItem.price *
                  controller.selectedOrderItem.quantity
              )
            : ''
        }
        onClose={() => controller.setSelectedOrderItem(null)}
      />
    </View>
  );
}
