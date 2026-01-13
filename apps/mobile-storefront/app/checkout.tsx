/**
 * Checkout Screen
 * Multi-step checkout: Address -> Payment -> Confirmation
 *
 * 2025 Best Practices:
 * - react-hook-form for form management
 * - Zod resolver for validation
 * - Analytics tracking and push notifications
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import Colors, { BRAND } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useCartStore, formatPrice } from '@/stores/cart-store';
import { useAuthStore } from '@/stores/auth-store';
import { calculateCommerce } from '@/lib/supabase';
import { ShippingAddressSchema } from '@/lib/validation';
import { scheduleLocalNotification } from '@/services/push-notifications';
import {
  trackCheckoutStarted,
  trackCheckoutStep,
  trackOrderCompleted,
  trackError,
} from '@/services/analytics';

type CheckoutStep = 'address' | 'payment' | 'review';

// Infer type from Zod schema
type ShippingAddressInput = z.infer<typeof ShippingAddressSchema>;

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_transfer' | 'pay_on_delivery';
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'card',
    type: 'card',
    label: 'Card Payment',
    description: 'Pay with Visa, Mastercard, or Verve',
    icon: 'card-outline',
  },
  {
    id: 'bank_transfer',
    type: 'bank_transfer',
    label: 'Bank Transfer',
    description: 'Pay via direct bank transfer',
    icon: 'business-outline',
  },
  {
    id: 'pay_on_delivery',
    type: 'pay_on_delivery',
    label: 'Pay on Delivery',
    description: 'Pay when you receive your order',
    icon: 'cash-outline',
  },
];

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
  const [selectedPayment, setSelectedPayment] = React.useState<string>('card');

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
      } catch (err) {
        console.error('Failed to fetch totals from brain', err);
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
    setIsProcessing(true);

    try {
      // Track review step completion
      trackCheckoutStep('review');

      // Simulate order creation (replace with actual API call)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Generate mock order number for demo
      const orderNumber = `OGA-${Date.now().toString().slice(-8)}`;

      // Track order completed
      trackOrderCompleted({
        orderId: `order_${Date.now()}`,
        orderNumber,
        total: total,
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
        { type: 'order_update', orderNumber },
        1 // Trigger after 1 second
      );

      // Clear cart after successful order
      clearCart();

      // Navigate to success screen
      router.replace('/order-success');
    } catch (error) {
      // Track error
      trackError(
        'checkout_failed',
        error instanceof Error ? error.message : 'Unknown error',
        { step: 'place_order', paymentMethod: selectedPayment }
      );
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStepIndicator = () => (
    <View
      style={styles.stepIndicator}
      accessibilityRole="header"
      accessibilityLabel={`Checkout progress: Step ${step === 'address' ? '1 of 3' : step === 'payment' ? '2 of 3' : '3 of 3'}`}
    >
      {['address', 'payment', 'review'].map((s, index) => {
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
              accessibilityLabel={`Step ${index + 1}: ${s}`}
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
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );

  // Form field component with error handling
  const FormField = ({
    name,
    label,
    placeholder,
    keyboardType = 'default',
    multiline = false,
    style,
  }: {
    name: keyof ShippingAddressInput;
    label: string;
    placeholder: string;
    keyboardType?: 'default' | 'phone-pad' | 'email-address';
    multiline?: boolean;
    style?: object;
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
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Payment Method
      </Text>

      {PAYMENT_METHODS.map((method) => (
        <Pressable
          key={method.id}
          style={[
            styles.paymentOption,
            {
              backgroundColor: colors.card,
              borderColor:
                selectedPayment === method.id ? BRAND.primary : colors.border,
            },
          ]}
          onPress={() => setSelectedPayment(method.id)}
        >
          <View
            style={[
              styles.paymentIconContainer,
              { backgroundColor: BRAND.primaryLight },
            ]}
          >
            <Ionicons name={method.icon} size={24} color={BRAND.primary} />
          </View>
          <View style={styles.paymentInfo}>
            <Text style={[styles.paymentLabel, { color: colors.text }]}>
              {method.label}
            </Text>
            <Text
              style={[
                styles.paymentDescription,
                { color: colors.textSecondary },
              ]}
            >
              {method.description}
            </Text>
          </View>
          <View
            style={[
              styles.radioOuter,
              {
                borderColor:
                  selectedPayment === method.id ? BRAND.primary : colors.border,
              },
            ]}
          >
            {selectedPayment === method.id && (
              <View
                style={[styles.radioInner, { backgroundColor: BRAND.primary }]}
              />
            )}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderReview = () => {
    const address = getValues();

    return (
      <ScrollView
        style={styles.formContainer}
        showsVerticalScrollIndicator={false}
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
            {PAYMENT_METHODS.find((m) => m.id === selectedPayment)?.label}
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
    padding: 8,
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
  fieldError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
});
