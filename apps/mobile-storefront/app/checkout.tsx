/**
 * Checkout Screen
 * Multi-step checkout: Address -> Payment -> Confirmation
 *
 * 2026 Best Practices:
 * - react-hook-form for form management
 * - Zod resolver for validation
 * - Analytics tracking and push notifications
 * - Duplicate order prevention (ref-based lock)
 */

import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { z } from 'zod';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { TextContentTypes, type TextContentType } from '@/hooks/use-keyboard';
import { calculateCommerce } from '@/lib/supabase';
import { ShippingAddressSchema } from '@/lib/validation';
import {
  trackCheckoutStarted,
  trackCheckoutStep,
  trackError,
  trackOrderCompleted,
} from '@/services/analytics';
import { createOrder, OrderError } from '@/services/orders';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';
import { formatPrice, useCartStore } from '@/stores/cart-store';
import {
  PaymentMethodSelector,
  type PaymentMethodType,
  type PaymentTab,
} from '@/components/checkout/PaymentMethodSelector';

type CheckoutStep = 'address' | 'payment' | 'review';

// Infer type from Zod schema
type ShippingAddressInput = z.infer<typeof ShippingAddressSchema>;

// Payment method labels for display
const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  paystack: 'Card Payment (Paystack)',
  korapay: 'Card Payment (Korapay)',
  bank_transfer: 'Bank Transfer',
  pay_on_delivery: 'Pay on Delivery',
  credpal: 'CredPal (Buy Now Pay Later)',
  credit_direct: 'Credit Direct (Installments)',
};

export default function CheckoutScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal());
  const clearCart = useCartStore((state) => state.clearCart);
  const customer = useAuthStore((state) => state.customer);

  const [step, setStep] = React.useState<CheckoutStep>('address');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [orderTotals, setOrderTotals] = React.useState<{
    total: number;
    taxAmount: number;
  } | null>(null);
  const [selectedPayment, setSelectedPayment] =
    React.useState<PaymentMethodType>('paystack');
  const [paymentTab, setPaymentTab] = React.useState<PaymentTab>('full');

  // React Hook Form with Zod resolver
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    getValues,
  } = useForm<ShippingAddressInput>({
    resolver: zodResolver(ShippingAddressSchema),
    defaultValues: {
      firstName: customer?.first_name || '',
      lastName: customer?.last_name || '',
      phone: customer?.phone || '',
      address: '',
      city: '',
      state: 'Lagos',
      notes: '',
    },
    mode: 'onBlur', // Validate on blur for better UX
  });

  // Watch state for delivery fee calculation
  const watchedState = watch('state');

  // Track if checkout_started has been fired
  const hasTrackedStart = useRef(false);

  // 2026 Best Practice: Ref-based lock to prevent duplicate order submissions
  // This prevents race conditions from rapid button presses
  const isOrderInFlight = useRef(false);

  // Track checkout started on mount
  useEffect(() => {
    if (!hasTrackedStart.current && items.length > 0) {
      trackCheckoutStarted({
        itemCount: items.reduce((acc, item) => acc + item.quantity, 0),
        subtotal,
        currency: 'NGN',
      });
      hasTrackedStart.current = true;
    }
  }, [items, subtotal]);

  // 2026 Best Practice: Handle Android back button in checkout
  // Prevents accidental exits during order processing
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If order is being processed, block back button entirely
      if (isOrderInFlight.current) {
        return true; // Consume the event, don't go back
      }

      // If on first step, show confirmation before leaving checkout
      if (step === 'address') {
        Alert.alert(
          'Leave Checkout?',
          'Your cart items will be saved. Are you sure you want to leave?',
          [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => router.back() },
          ]
        );
        return true; // Consume the event, handled with alert
      }

      // On other steps, go to previous step
      handleBack();
      return true; // Consume the event
    });

    return () => backHandler.remove();
  }, [step]);

  // Calculate totals via Brain
  const deliveryFee = watchedState === 'Lagos' ? 2500 : 5000;

  useEffect(() => {
    const fetchTotals = async () => {
      try {
        const result = await calculateCommerce('calculate_order', {
          subtotal,
          shippingFee: deliveryFee,
          taxRate: 0.075, // Nigeria Standard
        });
        setOrderTotals(result);
      } catch {
        // Silent fail - use fallback calculation
      }
    };
    fetchTotals();
  }, [subtotal, deliveryFee]);

  const total = orderTotals?.total || subtotal + deliveryFee;

  const onAddressSubmit = (data: ShippingAddressInput) => {
    // Track shipping info completed
    trackCheckoutStep('shipping_info', {
      state: data.state,
      city: data.city,
    });
    setStep('payment');
  };

  const handleContinue = () => {
    // 2026 Best Practice: Dismiss keyboard before continuing
    Keyboard.dismiss();

    if (step === 'address') {
      handleSubmit(onAddressSubmit)();
    } else if (step === 'payment') {
      // Track payment method selected
      trackCheckoutStep('payment_method', {
        payment_method: selectedPayment,
      });
      setStep('review');
    }
  };

  const handleBack = () => {
    if (step === 'payment') {
      setStep('address');
    } else if (step === 'review') {
      setStep('payment');
    } else {
      router.back();
    }
  };

  const handlePlaceOrder = async () => {
    // 2026 Best Practice: Prevent duplicate order submission
    // Ref check prevents race condition from rapid button presses
    if (isOrderInFlight.current) {
      return;
    }

    // Check for empty cart (e.g., if user navigated back after clearing cart)
    if (items.length === 0) {
      Alert.alert(
        'Empty Cart',
        'Your cart is empty. Please add items before checking out.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
      return;
    }

    isOrderInFlight.current = true;
    setIsProcessing(true);

    try {
      // Track review step completion
      trackCheckoutStep('review');

      const address = getValues();
      const customerEmail = customer?.email || '';
      const customerPhone = address.phone;
      const customerName = `${address.firstName} ${address.lastName}`;

      // Check if BNPL payment method selected
      const isBNPL =
        selectedPayment === 'credpal' || selectedPayment === 'credit_direct';

      if (isBNPL) {
        // For BNPL, create order first then redirect to payment
        const orderResponse = await createOrder({
          customer_email: customerEmail,
          customer_name: customerName,
          customer_phone: customerPhone,
          items: items.map((item) => ({
            id: item.id,
            product_id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image_url: item.image_url,
          })),
          subtotal,
          shipping_fee: deliveryFee,
          tax_amount: orderTotals?.taxAmount || 0,
          payment_method: selectedPayment,
          shipping_address: address,
          source: 'mobile_app',
        });

        // Navigate to BNPL checkout screen with real order ID
        router.push({
          pathname: '/bnpl-checkout',
          params: {
            orderId: orderResponse.order.id,
            gateway: selectedPayment,
            amount: String(orderResponse.amountDueToGateway),
            customerEmail,
            customerName,
            customerPhone,
            merchantSlug: 'ogabassey',
          },
        });
        setIsProcessing(false);
        return;
      }

      // 2026 Best Practice: Create order via API (not simulated)
      // Cart is only cleared AFTER successful order confirmation
      const orderResponse = await createOrder({
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        items: items.map((item) => ({
          id: item.id,
          product_id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image_url: item.image_url,
        })),
        subtotal,
        shipping_fee: deliveryFee,
        tax_amount: orderTotals?.taxAmount || 0,
        payment_method: selectedPayment,
        shipping_address: address,
        source: 'mobile_app',
      });

      const { order } = orderResponse;
      const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();

      // Track order completed with real order data
      trackOrderCompleted({
        orderId: order.id,
        orderNumber,
        total: order.total,
        subtotal,
        shipping: deliveryFee,
        tax: orderTotals?.taxAmount,
        currency: 'NGN',
        itemCount: items.reduce((acc, item) => acc + item.quantity, 0),
        paymentMethod: selectedPayment,
      });

      // Send local push notification
      await scheduleLocalNotification(
        'Order Received! 📦',
        `Your order #${orderNumber} is being processed. We'll notify you when it ships.`,
        { type: 'order_update', orderNumber, orderId: order.id },
        1 // Trigger after 1 second
      );

      // 2026 Best Practice: Clear cart ONLY after successful order creation
      // This is atomic - if order fails, cart is preserved
      clearCart();

      // Navigate to success screen with order details
      router.replace({
        pathname: '/order-success',
        params: {
          orderId: order.id,
          orderNumber,
        },
      });
    } catch (error) {
      // Handle OrderError with user-friendly messages
      if (error instanceof OrderError) {
        trackError('checkout_failed', error.message, {
          step: 'place_order',
          paymentMethod: selectedPayment,
          errorCode: error.code,
        });

        // Show specific error messages based on error code
        switch (error.code) {
          case 'NETWORK_ERROR':
            Alert.alert(
              'No Connection',
              'Please check your internet connection and try again.',
              [{ text: 'OK' }]
            );
            break;
          case 'VALIDATION_ERROR':
            Alert.alert(
              'Invalid Information',
              error.message || 'Please check your order details and try again.',
              [{ text: 'OK' }]
            );
            break;
          case 'AUTH_ERROR':
            Alert.alert(
              'Session Expired',
              'Please sign in again to complete your order.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign In', onPress: () => router.push('/auth/login') },
              ]
            );
            break;
          default:
            Alert.alert(
              'Order Failed',
              error.message || 'Something went wrong. Please try again.',
              [{ text: 'OK' }]
            );
        }
      } else {
        // Track unknown error
        trackError(
          'checkout_failed',
          error instanceof Error ? error.message : 'Unknown error',
          { step: 'place_order', paymentMethod: selectedPayment }
        );
        Alert.alert(
          'Error',
          'Failed to place order. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsProcessing(false);
      isOrderInFlight.current = false;
    }
  };

  // 2026 Accessibility: Step names for better screen reader experience
  const STEP_NAMES = {
    address: 'Delivery Address',
    payment: 'Payment Method',
    review: 'Review Order',
  };

  const renderStepIndicator = () => (
    <View
      style={styles.stepIndicator}
      accessibilityRole="progressbar"
      accessibilityLabel={`Checkout progress: Step ${step === 'address' ? '1' : step === 'payment' ? '2' : '3'} of 3, ${STEP_NAMES[step]}`}
      accessibilityValue={{
        min: 1,
        max: 3,
        now: step === 'address' ? 1 : step === 'payment' ? 2 : 3,
        text: STEP_NAMES[step],
      }}
    >
      {(['address', 'payment', 'review'] as const).map((s, index) => {
        const isActive = s === step;
        const isCompleted =
          (s === 'address' && (step === 'payment' || step === 'review')) ||
          (s === 'payment' && step === 'review');

        return (
          <React.Fragment key={s}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor:
                    isActive || isCompleted ? BRAND.primary : colors.border,
                },
              ]}
              accessible={true}
              accessibilityLabel={`Step ${index + 1}: ${STEP_NAMES[s]}${isCompleted ? ', completed' : isActive ? ', current step' : ''}`}
              accessibilityState={{ selected: isActive, checked: isCompleted }}
            >
              {isCompleted ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    { color: isActive ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            {index < 2 && (
              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor: isCompleted
                      ? BRAND.primary
                      : colors.border,
                  },
                ]}
                importantForAccessibility="no"
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );

  // 2026 Best Practice: Map field names to iOS textContentType for autofill
  const TEXT_CONTENT_TYPE_MAP: Partial<Record<keyof ShippingAddressInput, TextContentType>> = {
    firstName: TextContentTypes.givenName,
    lastName: TextContentTypes.familyName,
    phone: TextContentTypes.telephoneNumber,
    address: TextContentTypes.fullStreetAddress,
    city: TextContentTypes.addressCity,
  };

  // React Native TextInput autoComplete prop type
  type TextInputAutoComplete = React.ComponentProps<typeof TextInput>['autoComplete'];

  // 2026 Best Practice: Map field names to Android autoComplete for autofill
  const AUTO_COMPLETE_MAP: Partial<Record<keyof ShippingAddressInput, TextInputAutoComplete>> = {
    firstName: 'name-given',
    lastName: 'name-family',
    phone: 'tel',
    address: 'street-address',
    city: 'postal-address-locality', // Valid React Native autoComplete value for city
  };

  // Form field component with error handling and 2026 keyboard/autofill best practices
  const FormField = ({
    name,
    label,
    placeholder,
    keyboardType = 'default',
    multiline = false,
    style,
    returnKeyType = 'next',
    onSubmitEditing,
  }: {
    name: keyof ShippingAddressInput;
    label: string;
    placeholder: string;
    keyboardType?: 'default' | 'phone-pad' | 'email-address';
    multiline?: boolean;
    style?: object;
    returnKeyType?: 'next' | 'done' | 'go';
    onSubmitEditing?: () => void;
  }) => (
    <View style={[styles.inputGroup, style]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[
              styles.input,
              multiline && styles.multilineInput,
              { backgroundColor: colors.card, color: colors.text },
              { borderColor: errors[name] ? '#EF4444' : colors.border },
            ]}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            keyboardType={keyboardType}
            multiline={multiline}
            numberOfLines={multiline ? 2 : 1}
            accessibilityLabel={label}
            accessibilityHint={`Enter your ${label}`}
            // 2026 Best Practice: textContentType for iOS autofill
            textContentType={TEXT_CONTENT_TYPE_MAP[name]}
            // 2026 Best Practice: autoComplete for Android autofill
            autoComplete={AUTO_COMPLETE_MAP[name]}
            // 2026 Best Practice: Better keyboard UX
            returnKeyType={multiline ? 'default' : returnKeyType}
            blurOnSubmit={!multiline}
            onSubmitEditing={onSubmitEditing}
          />
        )}
      />
      {errors[name] && (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          {errors[name]?.message}
        </Text>
      )}
    </View>
  );

  const renderAddressForm = () => (
    <ScrollView
      style={styles.formContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Delivery Address
      </Text>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <FormField name="firstName" label="First Name" placeholder="John" />
        </View>
        <View style={styles.halfInput}>
          <FormField name="lastName" label="Last Name" placeholder="Doe" />
        </View>
      </View>

      <FormField
        name="phone"
        label="Phone Number"
        placeholder="08012345678"
        keyboardType="phone-pad"
      />

      <FormField
        name="address"
        label="Street Address"
        placeholder="123 Example Street, Lekki Phase 1"
        multiline
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <FormField name="city" label="City" placeholder="Lagos" />
        </View>
        <View style={styles.halfInput}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            State
          </Text>
          <Controller
            control={control}
            name="state"
            render={({ field: { value } }) => (
              <View
                style={[
                  styles.input,
                  styles.selectInput,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={{ color: colors.text }}>{value}</Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
            )}
          />
        </View>
      </View>

      <FormField
        name="notes"
        label="Delivery Notes (Optional)"
        placeholder="Any special instructions for delivery"
        multiline
      />
    </ScrollView>
  );

  const renderPaymentOptions = () => (
    <ScrollView
      style={styles.formContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Payment Method
      </Text>

      <PaymentMethodSelector
        selectedMethod={selectedPayment}
        onSelectMethod={setSelectedPayment}
        selectedTab={paymentTab}
        onSelectTab={setPaymentTab}
        orderTotal={total}
      />
    </ScrollView>
  );

  const renderReview = () => {
    const address = getValues();

    return (
      <ScrollView
        style={styles.formContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Order Review
        </Text>

        {/* Delivery Address Summary */}
        <View
          style={[
            styles.reviewCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.reviewHeader}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>
              Delivery Address
            </Text>
            <Pressable onPress={() => setStep('address')}>
              <Text style={[styles.editLink, { color: BRAND.primary }]}>
                Edit
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {address.firstName} {address.lastName}
          </Text>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {address.phone}
          </Text>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {address.address}, {address.city}, {address.state}
          </Text>
        </View>

        {/* Payment Method Summary */}
        <View
          style={[
            styles.reviewCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.reviewHeader}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>
              Payment Method
            </Text>
            <Pressable onPress={() => setStep('payment')}>
              <Text style={[styles.editLink, { color: BRAND.primary }]}>
                Edit
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {PAYMENT_METHOD_LABELS[selectedPayment]}
          </Text>
        </View>

        {/* Order Items Summary */}
        <View
          style={[
            styles.reviewCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.reviewTitle, { color: colors.text }]}>
            Order Items ({items.length})
          </Text>
          {items.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <Text
                style={[styles.orderItemName, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[styles.orderItemQty, { color: colors.textSecondary }]}
              >
                x{item.quantity}
              </Text>
              <Text style={[styles.orderItemPrice, { color: colors.text }]}>
                {formatPrice(item.price * item.quantity)}
              </Text>
            </View>
          ))}
        </View>

        {/* Order Total */}
        <View
          style={[
            styles.totalCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Subtotal
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formatPrice(subtotal)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Delivery
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formatPrice(deliveryFee)}
            </Text>
          </View>
          {orderTotals && (
            <View style={styles.totalRow}>
              <Text
                style={[styles.totalLabel, { color: colors.textSecondary }]}
              >
                VAT (7.5%)
              </Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {formatPrice(orderTotals.taxAmount)}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={[styles.grandTotalLabel, { color: colors.text }]}>
              Total
            </Text>
            <Text style={[styles.grandTotalValue, { color: BRAND.primary }]}>
              {formatPrice(total)}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Checkout',
          headerLeft: () => (
            <Pressable onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderStepIndicator()}

        {step === 'address' && renderAddressForm()}
        {step === 'payment' && renderPaymentOptions()}
        {step === 'review' && renderReview()}

        {/* Bottom Action */}
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.bottomAction,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          {step === 'review' ? (
            <Pressable
              style={[styles.actionButton, { backgroundColor: BRAND.primary }]}
              onPress={handlePlaceOrder}
              disabled={isProcessing}
              accessibilityRole="button"
              accessibilityLabel={`Place order for ${formatPrice(total)}`}
              accessibilityState={{ disabled: isProcessing, busy: isProcessing }}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.actionButtonText}>Place Order</Text>
                  <Text style={styles.actionButtonPrice}>
                    {formatPrice(total)}
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.actionButton, { backgroundColor: BRAND.primary }]}
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel={`Continue to ${step === 'address' ? 'payment' : 'review'}`}
            >
              <Text style={styles.actionButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </Pressable>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBtn: {
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  paymentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentInfo: {
    flex: 1,
    marginLeft: 16,
  },
  paymentLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  paymentDescription: {
    fontSize: 13,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  reviewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  editLink: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 22,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderItemName: {
    flex: 1,
    fontSize: 14,
  },
  orderItemQty: {
    fontSize: 13,
    marginHorizontal: 12,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 100,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 16,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  actionButtonPrice: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    opacity: 0.9,
  },
  // 2026 Best Practice: More visible error styling
  fieldError: {
    color: '#DC2626', // Darker red for better contrast (WCAG AA)
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
