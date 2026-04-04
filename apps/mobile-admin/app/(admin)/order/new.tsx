/**
 * New Order Screen (Record a Sale)
 * Redesigned to match "Record a sale" UI inspiration
 */

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Crypto from 'expo-crypto';
import { router, Stack } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import PhoneInput from 'react-native-phone-number-input';
import { SafeAreaView } from 'react-native-safe-area-context';
import SafeImage from '@/components/ui/SafeImage';
import {
  sanitizeAddress,
  sanitizeCustomerName,
  sanitizeEmail,
  sanitizeNotes,
  sanitizePhone,
  sanitizeText,
} from '@/lib/sanitize';
import { mergeOrderItem } from '@/lib/order-items';

interface ShippingAddress {
  name: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
}

import {
  BRAND_COLORS,
  ORDER_SOURCE_CONFIG,
  type OrderSource,
  type PaymentStatus,
} from '@baci/shared';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  type Customer,
  useCreateCustomer,
  useCustomers,
} from '@/hooks/useCustomers';
import { useDebounce } from '@/hooks/useDebounce';
import { useMerchant } from '@/hooks/useMerchant';
import { type Product, useProducts } from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

// Type definitions
interface OrderItem {
  product_id: string; // 'custom' for manual items
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
  details?: string;
  is_custom?: boolean;
}

interface CustomerInfo {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
}

type SelectableCustomer = Pick<
  Customer,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'address'
>;

/**
 * Formats a price string with thousand separators while preserving decimal input
 */
function formatPriceInput(value: string | undefined): string {
  if (!value) return '';
  const parts = value.split('.');
  const rawInt = parts[0].replace(/,/g, '');
  const formattedInt =
    !Number.isNaN(Number(rawInt)) && rawInt !== ''
      ? Number(rawInt).toLocaleString('en-US')
      : parts[0];
  return parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt;
}

const CHANNELS: {
  id: OrderSource;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  {
    id: 'physical',
    label: 'Physical sales',
    icon: 'storefront',
    color: ORDER_SOURCE_CONFIG?.physical?.colorKey || 'primary',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: 'logo-instagram',
    color: BRAND_COLORS?.instagram || '#E4405F',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: 'logo-whatsapp',
    color: BRAND_COLORS?.whatsapp || '#25D366',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: 'logo-facebook',
    color: BRAND_COLORS?.facebook || '#1877F2',
  },
  {
    id: 'tiktok',
    label: 'Tiktok',
    icon: 'logo-tiktok',
    color: BRAND_COLORS?.tiktok || '#000000',
  },
  {
    id: 'jumia',
    label: 'Jumia',
    icon: 'cart',
    color: BRAND_COLORS?.jumia || '#F68B1E',
  },
  {
    id: 'jiji',
    label: 'Jiji',
    icon: 'pricetag',
    color: BRAND_COLORS?.jiji || '#3DB83A',
  },
  {
    id: 'konga',
    label: 'Konga',
    icon: 'bag',
    color: BRAND_COLORS?.konga || '#ED017F',
  },
];

const PAYMENT_METHODS = [
  { id: 'transfer', label: 'Transfer', icon: 'card-outline' },
  { id: 'cash', label: 'Cash', icon: 'cash-outline' },
  { id: 'pos', label: 'POS', icon: 'calculator-outline' },
];

export default function NewOrderScreen() {
  const { colors, shadows } = useTheme();
  const { merchant } = useMerchant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: productsData } = useProducts();
  const createCustomerMutation = useCreateCustomer();

  // State
  const [date, setDate] = useState(new Date());
  const [selectedChannel, setSelectedChannel] =
    useState<OrderSource>('physical');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [customer, setCustomer] = useState<CustomerInfo>({
    id: null,
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref-based flag to prevent duplicate submissions (guards against race conditions)
  const isSubmittingRef = useRef(false);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editPriceValue, setEditPriceValue] = useState('');
  const [editQtyValue, setEditQtyValue] = useState('');
  const [editDetails, setEditDetails] = useState('');

  // Financials
  const [discount, setDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [taxes, setTaxes] = useState(0);
  const [isVatApplied, setIsVatApplied] = useState(false);
  const [showFinancialModal, setShowFinancialModal] = useState<{
    type: 'discount' | 'shipping' | 'tax';
    visible: boolean;
  }>({ type: 'discount', visible: false });
  const [financialValue, setFinancialValue] = useState('');

  // Search & Form
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);
  const { data: customersData } = useCustomers({
    search: debouncedCustomerSearch,
    sortBy: 'alpha',
  });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('NG'); // For Google Places filtering
  const [duplicateCustomer, setDuplicateCustomer] =
    useState<SelectableCustomer | null>(null);

  // Delivery Details
  const [sameAsCustomer, setSameAsCustomer] = useState(true);
  const [deliveryInfo, setDeliveryInfo] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
  });

  const [customItem, setCustomItem] = useState({ name: '', price: '' });

  // Initialize VAT status from merchant
  React.useEffect(() => {
    if (merchant?.vat_registration_status === 'registered') {
      setIsVatApplied(true);
    }
  }, [merchant?.vat_registration_status]);

  const [partialAmount, setPartialAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transfer');

  // Helpers
  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: merchant?.payout_currency || 'NGN',
      minimumFractionDigits: 2,
    }).format(amount);

  // Filter Products
  const allProducts = productsData?.pages
    ? productsData.pages.flatMap((page) => page.products || [])
    : [];

  const filteredProducts = productSearch
    ? allProducts.filter((p) => {
        const search = productSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(search) ||
          p.sku?.toLowerCase().includes(search)
        );
      })
    : allProducts;

  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // VAT Logic
  const vatRate = merchant?.vat_rate ? merchant.vat_rate / 100 : 0.075;
  const calculatedVat = Math.round((subtotal - discount) * vatRate);
  const taxesToUse = isVatApplied ? calculatedVat : taxes;

  const total = subtotal - discount + shippingFee + taxesToUse;

  // Handlers (Same logic, just keeping cleanly separated)
  const handleAddProduct = (product: Product) => {
    setOrderItems((prev) =>
      mergeOrderItem(prev, {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        image_url: product.images?.[0],
      })
    );
    setShowProductModal(false);
    setProductSearch('');
  };

  const handleAddCustomItem = () => {
    const normalizedName = customItem.name.trim().replace(/\s+/g, ' ');

    if (!normalizedName || !customItem.price) return;

    setOrderItems((prev) =>
      mergeOrderItem(prev, {
        product_id: `custom-${Crypto.randomUUID()}`,
        name: normalizedName,
        quantity: 1,
        price: Number.parseFloat(customItem.price) || 0,
        is_custom: true,
      })
    );
    setCustomItem({ name: '', price: '' });
    setShowCustomItemModal(false);
  };

  const handleQuantityChange = (id: string, delta: number) => {
    setOrderItems((prev) =>
      prev
        .map((item) => {
          if (item.product_id !== id) return item;
          return { ...item, quantity: Math.max(0, item.quantity + delta) };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleSelectCustomer = (item: SelectableCustomer) => {
    const displayName =
      [item.first_name, item.last_name]
        .filter((name): name is string => Boolean(name))
        .join(' ') ||
      item.email?.split('@')[0] ||
      '';
    setCustomer({
      id: item.id,
      name: displayName,
      email: item.email || '',
      phone: item.phone || '',
      address: item.address || '',
    });
    setShowCustomerModal(false);
    setCustomerSearch('');
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.firstName || !newCustomer.phone) {
      Alert.alert('Required', 'First Name and Phone are required');
      return;
    }

    try {
      // Check for existing customer by phone or email
      // const _existingQuery = supabase...

      // Build OR condition for phone and email
      const conditions: string[] = [];
      if (newCustomer.phone) {
        conditions.push(`phone.eq.${newCustomer.phone}`);
      }
      if (newCustomer.email) {
        conditions.push(`email.eq.${newCustomer.email}`);
      }

      const { data: existingCustomers, error: searchError } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, address')
        .eq('merchant_id', merchant?.id)
        .or(conditions.join(','))
        .limit(1);

      if (searchError) {
        console.error('Error checking for existing customer:', searchError);
      }

      // If customer exists, show them instead of creating
      if (existingCustomers && existingCustomers.length > 0) {
        setDuplicateCustomer(existingCustomers[0]);
        return;
      }

      // No duplicate found, create new customer
      const customer = await createCustomerMutation.mutateAsync({
        first_name: newCustomer.firstName,
        last_name: newCustomer.lastName,
        phone: newCustomer.phone,
        email: newCustomer.email || undefined,
        address: newCustomer.address || undefined,
      });

      handleSelectCustomer(customer);
      setIsCreatingCustomer(false);
      setNewCustomer({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        address: '',
      });
    } catch (error: unknown) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const generateOrderNumber = () => {
    const date = new Date();
    const prefix = 'ORD';
    const datePart = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getFullYear()).slice(-2)}`;
    const randomPart = Crypto.randomUUID()
      .replace(/-/g, '')
      .substring(0, 6)
      .toUpperCase();
    return `${prefix}-${datePart}-${randomPart}`;
  };

  const handleSubmit = async () => {
    // Guard against duplicate submissions using ref (prevents race condition on rapid clicks)
    if (isSubmittingRef.current) {
      return;
    }

    if (!customer.id || !customer.name) {
      Alert.alert('Required', 'Please select a customer for this order');
      return;
    }
    if (orderItems.length === 0) {
      Alert.alert('Required', 'Please add at least one product');
      return;
    }

    // Set ref immediately to prevent duplicate submissions
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const orderNumber = generateOrderNumber();

      // Sanitize all customer inputs to prevent XSS
      const sanitizedCustomerName =
        sanitizeCustomerName(customer.name) || 'Walk-in Customer';
      const sanitizedCustomerEmail = customer.email
        ? sanitizeEmail(customer.email)
        : null;
      const sanitizedCustomerPhone = customer.phone
        ? sanitizePhone(customer.phone)
        : null;
      const sanitizedCustomerAddress = customer.address
        ? sanitizeAddress(customer.address)
        : '';
      const sanitizedNotes = notes.trim() ? sanitizeNotes(notes) : null;

      // Sanitize delivery info
      const sanitizedDeliveryName = sanitizeCustomerName(deliveryInfo.name);
      const sanitizedDeliveryPhone = sanitizePhone(deliveryInfo.phone);
      const sanitizedDeliveryAddress = sanitizeAddress(deliveryInfo.address);
      const sanitizedDeliveryCity = sanitizeText(deliveryInfo.city, 100);
      const sanitizedDeliveryState = sanitizeText(deliveryInfo.state, 100);

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          merchant_id: merchant?.id,
          customer_id: customer.id,
          order_number: orderNumber,
          customer_name: sanitizedCustomerName,
          customer_email: sanitizedCustomerEmail,
          customer_phone: sanitizedCustomerPhone,
          shipping_status: 'pending',
          payment_status: paymentStatus,
          amount_paid:
            paymentStatus === 'partially_paid'
              ? Number.parseFloat(partialAmount) || 0
              : paymentStatus === 'paid'
                ? total
                : 0,
          payment_method:
            paymentStatus === 'paid' || paymentStatus === 'partially_paid'
              ? paymentMethod
              : null,
          total: total,
          subtotal: subtotal,
          discount_amount: discount,
          shipping_fee: shippingFee,
          tax_amount: taxesToUse,
          currency: merchant?.payout_currency || 'NGN',
          source: selectedChannel,
          recorded_by_user_id: user?.id || null,
          notes: sanitizedNotes,
          shipping_address: sameAsCustomer
            ? ({
                name: sanitizedCustomerName,
                phone: sanitizedCustomerPhone || '',
                address: sanitizedCustomerAddress,
              } satisfies ShippingAddress)
            : ({
                name: sanitizedDeliveryName,
                phone: sanitizedDeliveryPhone,
                address: sanitizedDeliveryAddress,
                city: sanitizedDeliveryCity,
                state: sanitizedDeliveryState,
              } satisfies ShippingAddress),
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Sanitize order item names and descriptions
      const { error: itemsError } = await supabase.from('order_items').insert(
        orderItems.map((item) => ({
          order_id: order.id,
          product_id: item.is_custom ? null : item.product_id,
          name: sanitizeText(item.name, 200),
          quantity: item.quantity,
          price: item.price,
          item_description: item.details
            ? sanitizeText(item.details, 1000)
            : null,
        }))
      );

      if (itemsError) throw itemsError;

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-counts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      setLastOrderId(order.id);
      setShowSuccessModal(true);
    } catch (error: unknown) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
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
            isSubmitting && <ActivityIndicator color={colors.primary} />,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: TYPOGRAPHY.fontFamily.regular },
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* SECTION 1: Details (Date & Customer) - List Style */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {/* Date Row */}
            <Pressable
              style={[
                styles.listRow,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
              ]}
              onPress={() => setShowDatePicker((p) => !p)}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: colors.backgroundLight },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.listLabel, { color: colors.text }]}>
                Date
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text
                  style={[styles.listValue, { color: colors.textSecondary }]}
                >
                  {format(date, 'MMM dd, yyyy')}
                </Text>
                <Ionicons
                  name={showDatePicker ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textMuted}
                />
              </View>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(_event, selectedDate) => {
                  if (Platform.OS === 'android') {
                    setShowDatePicker(false);
                  }
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}

            {/* Customer Row */}
            <Pressable
              style={styles.listRow}
              onPress={() => setShowCustomerModal(true)}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: colors.backgroundLight },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listLabel, { color: colors.text }]}>
                  Customer
                </Text>
                {customer.name ? (
                  <Text
                    style={[styles.listSubValue, { color: colors.success }]}
                  >
                    {customer.name}{' '}
                    {customer.phone ? `• ${customer.phone}` : ''}
                  </Text>
                ) : null}
              </View>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                {!customer.name && (
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 14,
                      fontWeight: '500',
                    }}
                  >
                    Select
                  </Text>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              </View>
            </Pressable>
          </View>

          {/* Delivery Details Section */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, marginTop: 16 },
            ]}
          >
            <View
              style={[
                styles.listRow,
                {
                  borderBottomColor: !sameAsCustomer
                    ? colors.border
                    : 'transparent',
                  borderBottomWidth: !sameAsCustomer ? 1 : 0,
                },
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: colors.backgroundLight },
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listLabel, { color: colors.text }]}>
                  Delivery Details
                </Text>
                <Text
                  style={[styles.listSubValue, { color: colors.textSecondary }]}
                >
                  {sameAsCustomer
                    ? 'Deliver to same person'
                    : 'Deliver to different person'}
                </Text>
              </View>
              <Switch
                value={sameAsCustomer}
                onValueChange={setSameAsCustomer}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={
                  Platform.OS === 'ios'
                    ? '#fff'
                    : sameAsCustomer
                      ? '#fff'
                      : '#f4f3f4'
                }
              />
            </View>

            {!sameAsCustomer && (
              <View style={{ padding: 16, gap: 12 }}>
                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: colors.textSecondary, marginBottom: 4 },
                    ]}
                  >
                    Recipient Name
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                    placeholder="e.g. Jane Doe"
                    placeholderTextColor={colors.textMuted}
                    value={deliveryInfo.name}
                    onChangeText={(text) =>
                      setDeliveryInfo((prev) => ({ ...prev, name: text }))
                    }
                  />
                </View>

                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: colors.textSecondary, marginBottom: 4 },
                    ]}
                  >
                    Recipient Phone
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                    placeholder="e.g. 080..."
                    placeholderTextColor={colors.textMuted}
                    value={deliveryInfo.phone}
                    keyboardType="phone-pad"
                    onChangeText={(text) =>
                      setDeliveryInfo((prev) => ({ ...prev, phone: text }))
                    }
                  />
                </View>

                <View style={{ zIndex: 5 }}>
                  <Text
                    style={[
                      styles.label,
                      { color: colors.textSecondary, marginBottom: 4 },
                    ]}
                  >
                    Delivery Address
                  </Text>
                  <GooglePlacesAutocomplete
                    placeholder="Enter delivery address"
                    onPress={(data, details = null) => {
                      if (details) {
                        const addressComponents = details.address_components;
                        let city = '';
                        let state = '';

                        addressComponents.forEach((component) => {
                          if (component.types.includes('locality'))
                            city = component.long_name;
                          if (
                            component.types.includes(
                              'administrative_area_level_1'
                            )
                          )
                            state = component.long_name;
                        });

                        setDeliveryInfo((prev) => ({
                          ...prev,
                          address: data.description,
                          city,
                          state,
                        }));
                      }
                    }}
                    query={{
                      key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
                      language: 'en',
                    }}
                    fetchDetails={true}
                    textInputProps={{
                      placeholderTextColor: colors.textMuted,
                      style: {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        fontSize: 16,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                      value: deliveryInfo.address,
                      onChangeText: (text) =>
                        setDeliveryInfo((prev) => ({ ...prev, address: text })),
                    }}
                    styles={{
                      container: { flex: 0 },
                      listView: {
                        backgroundColor: colors.card,
                        borderRadius: 8,
                        marginTop: 4,
                        borderWidth: 1,
                        borderColor: colors.border,
                        zIndex: 1000,
                        position: 'absolute',
                        top: 50,
                        left: 0,
                        right: 0,
                      },
                      row: { backgroundColor: 'transparent', padding: 12 },
                      description: { color: colors.text },
                      separator: { backgroundColor: colors.border },
                    }}
                    enablePoweredByContainer={false}
                    nearbyPlacesAPI="GooglePlacesSearch"
                    debounce={300}
                    keyboardShouldPersistTaps="handled"
                    listViewDisplayed="auto"
                  />
                </View>
              </View>
            )}
          </View>

          {/* SECTION 2: Sales Channel - Horizontal Scroll */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Sales Channel
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.channelScroll}
            >
              {CHANNELS.map((channel) => {
                const isSelected = selectedChannel === channel.id;
                const rawColor = channel.color || colors.primary;
                const activeColor = rawColor.startsWith('#')
                  ? rawColor
                  : colors[rawColor as keyof typeof colors] || colors.primary;

                return (
                  <Pressable
                    key={channel.id}
                    style={[
                      styles.channelPill,
                      {
                        backgroundColor: isSelected ? activeColor : colors.card,
                        borderColor: isSelected ? activeColor : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedChannel(channel.id)}
                  >
                    <Ionicons
                      name={channel.icon}
                      size={18}
                      color={isSelected ? '#fff' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.channelText,
                        { color: isSelected ? '#fff' : colors.text },
                      ]}
                    >
                      {channel.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* SECTION 3: Products */}
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Products
              </Text>
            </View>

            {/* New Item Actions - Modern Buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable
                style={[
                  styles.actionBtn,
                  {
                    flex: 1,
                    backgroundColor: `${colors.primary}10`,
                    borderColor: `${colors.primary}20`,
                  },
                ]}
                onPress={() => setShowCustomItemModal(true)}
              >
                <Ionicons
                  name="flash-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                  Quick Add
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.actionBtn,
                  {
                    flex: 1.2,
                    backgroundColor: colors.backgroundLight,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  setProductSearch('');
                  setShowProductModal(true);
                }}
              >
                <Ionicons
                  name="search"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Search Catalog
                </Text>
              </Pressable>
            </View>

            {/* Product List - Card Style Rows */}
            <View style={{ marginTop: 12, gap: 8 }}>
              {orderItems.length === 0 ? (
                <View
                  style={[styles.emptyState, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.textMuted }}>
                    No items added yet
                  </Text>
                </View>
              ) : (
                orderItems.map((item) => (
                  <View
                    key={item.product_id || item.name}
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {/* Thumbnail Rendering */}
                    <View
                      style={[
                        styles.itemThumbnail,
                        { backgroundColor: colors.backgroundLight },
                      ]}
                    >
                      {item.image_url ? (
                        <SafeImage
                          source={{ uri: item.image_url }}
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: 12,
                          }}
                        />
                      ) : (
                        <Ionicons
                          name="image-outline"
                          size={20}
                          color={colors.textMuted}
                        />
                      )}
                    </View>

                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                      <Text
                        style={[styles.itemTitle, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      {item.details ? (
                        <Text
                          style={{
                            color: colors.textMuted,
                            fontSize: 12,
                            marginBottom: 2,
                          }}
                        >
                          {item.details}
                        </Text>
                      ) : null}
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 13,
                          fontWeight: '600',
                          marginTop: 2,
                        }}
                      >
                        {formatPrice(item.price)}
                      </Text>

                      <Pressable
                        onPress={() => {
                          setEditingItem(item);
                          setEditPriceValue(item.price.toString());
                          setEditQtyValue(item.quantity.toString());
                          setEditDetails(item.details || '');
                          setShowEditItemModal(true);
                        }}
                        style={{
                          alignSelf: 'flex-start',
                          marginTop: 6,
                          borderBottomWidth: 1.5,
                          borderBottomColor: colors.primary,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: 13,
                            fontWeight: '700',
                            paddingBottom: 1,
                          }}
                        >
                          Edit
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.itemActions}>
                      <Pressable
                        onPress={() =>
                          handleQuantityChange(item.product_id, -1)
                        }
                        style={[
                          styles.qtyBtn,
                          { backgroundColor: colors.backgroundLight },
                        ]}
                      >
                        <Ionicons
                          name={item.quantity > 1 ? 'remove' : 'trash-outline'}
                          size={16}
                          color={item.quantity > 1 ? colors.text : colors.error}
                        />
                      </Pressable>
                      <Text
                        style={{
                          fontWeight: 'bold',
                          color: colors.text,
                          minWidth: 24,
                          textAlign: 'center',
                        }}
                      >
                        {item.quantity}
                      </Text>
                      <Pressable
                        onPress={() => handleQuantityChange(item.product_id, 1)}
                        style={[
                          styles.qtyBtn,
                          { backgroundColor: colors.backgroundLight },
                        ]}
                      >
                        <Ionicons name="add" size={16} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* SECTION 4: Summary Calculations */}
            <View
              style={[
                styles.summaryContainer,
                { borderTopColor: colors.border },
              ]}
            >
              <View style={styles.summaryRow}>
                <Text
                  style={[styles.summaryLabel, { color: colors.textSecondary }]}
                >
                  Subtotal
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {formatPrice(subtotal)}
                </Text>
              </View>

              <Pressable
                style={styles.summaryRow}
                onPress={() => {
                  setFinancialValue(discount > 0 ? discount.toString() : '');
                  setShowFinancialModal({ type: 'discount', visible: true });
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Discount
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color={colors.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: discount > 0 ? colors.error : colors.textMuted },
                  ]}
                >
                  {discount > 0 ? `- ${formatPrice(discount)}` : formatPrice(0)}
                </Text>
              </Pressable>

              <Pressable
                style={styles.summaryRow}
                onPress={() => {
                  setFinancialValue(
                    shippingFee > 0 ? shippingFee.toString() : ''
                  );
                  setShowFinancialModal({ type: 'shipping', visible: true });
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Shipping Fee
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color={colors.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: shippingFee > 0 ? colors.text : colors.textMuted },
                  ]}
                >
                  {formatPrice(shippingFee)}
                </Text>
              </Pressable>

              <Pressable
                style={styles.summaryRow}
                onPress={() => {
                  setFinancialValue(taxes > 0 ? taxes.toString() : '');
                  setShowFinancialModal({ type: 'tax', visible: true });
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {isVatApplied
                      ? `VAT (${(vatRate * 100).toFixed(1)}%)`
                      : 'Taxes'}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color={colors.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: taxesToUse > 0 ? colors.text : colors.textMuted },
                  ]}
                >
                  {formatPrice(taxesToUse)}
                </Text>
              </Pressable>

              <View
                style={[
                  styles.summaryRow,
                  {
                    marginTop: 4,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.text, fontWeight: '700', fontSize: 16 },
                  ]}
                >
                  Total Amount
                </Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: colors.text, fontWeight: '800', fontSize: 18 },
                  ]}
                >
                  {formatPrice(total)}
                </Text>
              </View>
            </View>
          </View>

          {/* SECTION 4: Notes */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Notes
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                { backgroundColor: colors.card, color: colors.text },
              ]}
              placeholder="Add internal notes..."
              placeholderTextColor={colors.textMuted}
              multiline
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Padding for footer */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Footer */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        {/* Payment Toggle inside Footer */}
        <View
          style={[styles.paymentToggle, { backgroundColor: colors.inputBg }]}
        >
          {(['unpaid', 'paid', 'partially_paid'] as PaymentStatus[]).map(
            (status) => {
              const isSelected = paymentStatus === status;
              return (
                <Pressable
                  key={status}
                  style={[
                    styles.toggleOption,
                    isSelected && {
                      backgroundColor: colors.background,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 1,
                      elevation: 2,
                    },
                  ]}
                  onPress={() => {
                    setPaymentStatus(status);
                    if (status !== 'partially_paid') {
                      setPartialAmount('');
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      {
                        color: isSelected
                          ? status === 'paid'
                            ? colors.success
                            : status === 'unpaid'
                              ? colors.error
                              : colors.warning
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {status === 'partially_paid'
                      ? 'Partial'
                      : status.toUpperCase()}
                  </Text>
                </Pressable>
              );
            }
          )}
        </View>

        {/* Payment Method Selector */}
        {['paid', 'partially_paid'].includes(paymentStatus) && (
          <View style={{ marginBottom: 4 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: colors.textSecondary,
                marginBottom: 8,
                marginLeft: 4,
              }}
            >
              Payment Method
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PAYMENT_METHODS.map((method) => (
                <Pressable
                  key={method.id}
                  onPress={() => setPaymentMethod(method.id)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor:
                      paymentMethod === method.id
                        ? colors.primary
                        : colors.card,
                    borderWidth: 1,
                    borderColor:
                      paymentMethod === method.id
                        ? colors.primary
                        : colors.border,
                  }}
                >
                  <Ionicons
                    name={method.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={paymentMethod === method.id ? '#fff' : colors.text}
                  />
                  <Text
                    style={{
                      color: paymentMethod === method.id ? '#fff' : colors.text,
                      fontWeight: '600',
                      fontSize: 13,
                    }}
                  >
                    {method.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Inline Partial Amount Input */}
        {paymentStatus === 'partially_paid' && (
          <View style={{ marginBottom: 4 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: colors.textSecondary,
                marginBottom: 8,
                marginLeft: 4,
              }}
            >
              Amount Paid
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.inputBg,
                color: colors.text,
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 12,
                fontSize: 16,
                fontWeight: '500',
              }}
              placeholder="Enter amount..."
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={partialAmount}
              onChangeText={setPartialAmount}
            />
          </View>
        )}

        <View style={styles.footerRow}>
          <View>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Total Amount
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 24,
                fontFamily: TYPOGRAPHY.fontFamily.bold,
              }}
            >
              {formatPrice(total)}
            </Text>
          </View>
          <Pressable
            style={[
              styles.payBtn,
              {
                backgroundColor: colors.primary,
                opacity: orderItems.length === 0 ? 0.6 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || orderItems.length === 0}
          >
            <Text style={styles.payBtnText}>Save Order</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* --- MODALS (Same functionality, simplified styles) --- */}

      {/* Product Modal */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Select Item
            </Text>
            <Pressable onPress={() => setShowProductModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <View
            style={[styles.searchBox, { backgroundColor: colors.cardHover }]}
          >
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={{ flex: 1, color: colors.text, marginLeft: 8 }}
              placeholder="Search products..."
              placeholderTextColor={colors.textMuted}
              value={productSearch}
              onChangeText={setProductSearch}
            />
          </View>

          {/* Create New Product Action */}
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.card,
            }}
            onPress={() => {
              setShowProductModal(false);
              router.push('/product/new');
            }}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: `${colors.primary}20` },
              ]}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: '600',
                  fontSize: 16,
                }}
              >
                Create New Product
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Add a new item to inventory
              </Text>
            </View>
          </Pressable>
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.productItem,
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => handleAddProduct(item)}
              >
                <View>
                  <Text style={{ color: colors.text, fontSize: 16 }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    SKU: {item.sku || 'N/A'}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: '500' }}>
                  {formatPrice(item.price)}
                </Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Custom Item Modal */}
      <Modal visible={showCustomItemModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>
              Quick Add Item
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                marginBottom: 16,
                fontStyle: 'italic',
              }}
            >
              This item will not be saved to your product inventory.
            </Text>
            <TextInput
              style={[
                styles.dialogInput,
                { backgroundColor: colors.inputBg, color: colors.text },
              ]}
              placeholder="Item Name (e.g. Red Cake, Delivery)"
              placeholderTextColor={colors.textMuted}
              value={customItem.name}
              onChangeText={(t) => setCustomItem((p) => ({ ...p, name: t }))}
            />
            <TextInput
              style={[
                styles.dialogInput,
                { backgroundColor: colors.inputBg, color: colors.text },
              ]}
              placeholder="Amount (0.00)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={formatPriceInput(customItem.price)}
              onChangeText={(t) => {
                const clean = t.replace(/[^0-9.]/g, '');
                setCustomItem((p) => ({ ...p, price: clean }));
              }}
            />
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setShowCustomItemModal(false)}
                style={styles.dialogBtn}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddCustomItem}
                style={[
                  styles.dialogBtn,
                  { backgroundColor: colors.success, borderRadius: 8 },
                ]}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  Add to Cart
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Partial Payment Modal */}

      {/* Customer Modal - Enhanced */}
      <Modal
        visible={showCustomerModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {isCreatingCustomer ? 'New Customer' : 'Select Customer'}
              </Text>
              {isCreatingCustomer && (
                <Pressable
                  onPress={() => setIsCreatingCustomer(false)}
                  style={{ marginTop: 4 }}
                >
                  <Text style={{ color: colors.primary }}>Back to search</Text>
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => {
                setShowCustomerModal(false);
                setIsCreatingCustomer(false);
                setNewCustomer({
                  firstName: '',
                  lastName: '',
                  phone: '',
                  email: '',
                  address: '',
                });
                setSelectedCountryCode('NG');
                setDuplicateCustomer(null);
              }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {isCreatingCustomer ? (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
                {/* Duplicate Customer Alert */}
                {duplicateCustomer && (
                  <View
                    style={{
                      backgroundColor: '#FEF3C7',
                      borderRadius: 12,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: '#F59E0B',
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: '#92400E', fontWeight: '600' }}>
                      ⚠️ Customer Already Exists
                    </Text>
                    <Pressable
                      onPress={() => {
                        handleSelectCustomer(duplicateCustomer);
                        setDuplicateCustomer(null);
                        setIsCreatingCustomer(false);
                        setNewCustomer({
                          firstName: '',
                          lastName: '',
                          phone: '',
                          email: '',
                          address: '',
                        });
                      }}
                      style={{
                        backgroundColor: '#FFF',
                        borderRadius: 8,
                        padding: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: colors.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: '#FFF',
                            fontWeight: 'bold',
                            fontSize: 16,
                          }}
                        >
                          {duplicateCustomer.first_name?.[0]?.toUpperCase() ||
                            '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', color: '#1F2937' }}>
                          {duplicateCustomer.first_name}{' '}
                          {duplicateCustomer.last_name}
                        </Text>
                        <Text style={{ color: '#6B7280', fontSize: 13 }}>
                          {duplicateCustomer.phone}
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: colors.primary,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: '#FFF',
                            fontWeight: '600',
                            fontSize: 13,
                          }}
                        >
                          Use This
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                )}

                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.textSecondary }}>
                    Personal Info
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TextInput
                      style={[
                        styles.sheetInput,
                        {
                          backgroundColor: colors.inputBg,
                          color: colors.text,
                          flex: 1,
                        },
                      ]}
                      placeholder="First Name"
                      placeholderTextColor={colors.textMuted}
                      value={newCustomer.firstName}
                      onChangeText={(t) =>
                        setNewCustomer((p) => ({ ...p, firstName: t }))
                      }
                    />
                    <TextInput
                      style={[
                        styles.sheetInput,
                        {
                          backgroundColor: colors.inputBg,
                          color: colors.text,
                          flex: 1,
                        },
                      ]}
                      placeholder="Last Name"
                      placeholderTextColor={colors.textMuted}
                      value={newCustomer.lastName}
                      onChangeText={(t) =>
                        setNewCustomer((p) => ({ ...p, lastName: t }))
                      }
                    />
                  </View>
                </View>

                <View style={{ gap: 8, zIndex: 5 }}>
                  <Text style={{ color: colors.textSecondary }}>
                    Contact Info
                  </Text>
                  <PhoneInput
                    defaultValue={newCustomer.phone}
                    defaultCode="NG"
                    layout="first"
                    onChangeFormattedText={(text) => {
                      setNewCustomer((p) => ({ ...p, phone: text }));
                    }}
                    onChangeCountry={(country) => {
                      setSelectedCountryCode(country.cca2);
                    }}
                    containerStyle={{
                      width: '100%',
                      borderRadius: 12,
                      backgroundColor: colors.inputBg,
                      height: 54,
                    }}
                    textContainerStyle={{
                      backgroundColor: 'transparent',
                      borderRadius: 12,
                    }}
                    textInputStyle={{
                      color: colors.text,
                      height: 50,
                    }}
                    codeTextStyle={{
                      color: colors.text,
                    }}
                    withDarkTheme={true}
                    withShadow={false}
                    placeholder="Mobile Phone"
                  />
                  <TextInput
                    style={[
                      styles.sheetInput,
                      { backgroundColor: colors.inputBg, color: colors.text },
                    ]}
                    placeholder="Email Address (Optional)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={newCustomer.email}
                    onChangeText={(t) =>
                      setNewCustomer((p) => ({ ...p, email: t }))
                    }
                  />
                </View>

                <View style={{ gap: 8, zIndex: 10 }}>
                  <Text style={{ color: colors.textSecondary }}>Address</Text>
                  <GooglePlacesAutocomplete
                    placeholder="Search Address"
                    onPress={(data, _details = null) => {
                      setNewCustomer((p) => ({
                        ...p,
                        address: data.description,
                      }));
                    }}
                    onFail={(error) => {
                      if (__DEV__) {
                        console.log('Google Places Error:', error);
                      }
                    }}
                    onNotFound={() => {
                      if (__DEV__) {
                        console.log('Google Places: No results');
                      }
                    }}
                    query={{
                      key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
                      language: 'en',
                      components: selectedCountryCode
                        ? `country:${selectedCountryCode.toLowerCase()}`
                        : undefined,
                    }}
                    textInputProps={{
                      placeholderTextColor: colors.textMuted,
                    }}
                    listViewDisplayed="auto"
                    keyboardShouldPersistTaps="handled"
                    keepResultsAfterBlur={true}
                    minLength={2}
                    styles={{
                      container: { flex: 0, zIndex: 999 },
                      textInput: {
                        height: 50,
                        borderRadius: 12,
                        backgroundColor: colors.inputBg,
                        color: colors.text,
                        paddingHorizontal: 16,
                        fontSize: 16,
                      },
                      listView: {
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        marginTop: 4,
                        position: 'absolute',
                        top: 54,
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        elevation: 5,
                      },
                      row: {
                        backgroundColor: colors.card,
                        padding: 13,
                      },
                      description: { color: colors.text },
                      poweredContainer: {
                        backgroundColor: colors.card,
                        borderBottomLeftRadius: 12,
                        borderBottomRightRadius: 12,
                      },
                    }}
                    enablePoweredByContainer={true}
                    fetchDetails={false}
                    debounce={300}
                  />
                </View>

                <Pressable
                  style={[
                    styles.payBtn,
                    {
                      backgroundColor: colors.primary,
                      marginTop: 16,
                      justifyContent: 'center',
                    },
                  ]}
                  onPress={handleCreateCustomer}
                  disabled={createCustomerMutation.isPending}
                >
                  {createCustomerMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.payBtnText}>Save Customer</Text>
                  )}
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            <>
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: colors.cardHover },
                ]}
              >
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                  style={{ flex: 1, color: colors.text, marginLeft: 8 }}
                  placeholder="Search name, email, or phone..."
                  placeholderTextColor={colors.textMuted}
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                />
              </View>

              <Pressable
                style={[
                  styles.listRow,
                  { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
                onPress={() => setIsCreatingCustomer(true)}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: `${colors.primary}20` },
                  ]}
                >
                  <Ionicons
                    name="person-add"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.listLabel,
                    { color: colors.primary, fontSize: 16 },
                  ]}
                >
                  Create new customer
                </Text>
              </Pressable>

              <FlatList
                data={customersData?.pages.flatMap((p) => p.customers) || []}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.listRow,
                      {
                        borderBottomColor: colors.border,
                        borderBottomWidth: 1,
                        paddingVertical: 12,
                      },
                    ]}
                    onPress={() => handleSelectCustomer(item)}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: colors.cardHover },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: 'bold',
                          color: colors.textSecondary,
                        }}
                      >
                        {(
                          item.first_name?.[0] ||
                          item.email?.[0] ||
                          '?'
                        ).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>
                        {`${item.first_name || ''} ${item.last_name || ''}`.trim() ||
                          'Unknown'}
                      </Text>
                      <Text
                        style={{ color: colors.textSecondary, fontSize: 13 }}
                      >
                        {item.phone || item.email || 'No contact info'}
                      </Text>
                    </View>
                    {item.total_orders > 0 && (
                      <View
                        style={[
                          styles.qtyBadge,
                          { backgroundColor: `${colors.success}20` },
                        ]}
                      >
                        <Text style={{ color: colors.success, fontSize: 12 }}>
                          {item.total_orders} orders
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 32, alignItems: 'center' }}>
                    <Text style={{ color: colors.textMuted }}>
                      No customers found
                    </Text>
                  </View>
                }
              />
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 32,
              padding: 32,
              width: '100%',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.1,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: `${colors.success}15`,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 24,
                borderWidth: 2,
                borderColor: `${colors.success}20`,
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={64}
                color={colors.success}
              />
            </View>

            <Text
              style={{
                fontSize: 28,
                fontWeight: '800',
                color: colors.text,
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              Sale Recorded!
            </Text>

            <Text
              style={{
                fontSize: 16,
                color: colors.textMuted,
                textAlign: 'center',
                marginBottom: 32,
                lineHeight: 22,
              }}
            >
              The order has been successfully saved to your records.
            </Text>

            <View style={{ width: '100%', gap: 12 }}>
              <Pressable
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  paddingVertical: 18,
                  borderRadius: 20,
                  alignItems: 'center',
                  opacity: pressed ? 0.9 : 1,
                  ...shadows.md,
                })}
                onPress={() => {
                  setShowSuccessModal(false);
                  if (lastOrderId) router.replace(`/order/${lastOrderId}`);
                }}
              >
                <Text
                  style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}
                >
                  View Order Details
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => ({
                  backgroundColor: colors.card,
                  paddingVertical: 18,
                  borderRadius: 20,
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                })}
                onPress={() => {
                  setShowSuccessModal(false);
                  setOrderItems([]);
                  setCustomer({
                    id: null,
                    name: '',
                    email: '',
                    phone: '',
                    address: '',
                  });
                  setNotes('');
                  setLastOrderId(null);
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 17,
                    fontWeight: '600',
                  }}
                >
                  Create New Sale
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Financials Modal (Discount, Shipping, Tax) */}
      <Modal
        visible={showFinancialModal.visible}
        transparent
        animationType="slide"
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() =>
            setShowFinancialModal({ ...showFinancialModal, visible: false })
          }
        >
          <Pressable
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 48,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <Text
                style={{ fontSize: 20, fontWeight: '700', color: colors.text }}
              >
                {showFinancialModal.type === 'discount'
                  ? 'Add Discount'
                  : showFinancialModal.type === 'shipping'
                    ? 'Shipping Fee'
                    : 'Taxes'}
              </Text>
              <Pressable
                onPress={() =>
                  setShowFinancialModal({
                    ...showFinancialModal,
                    visible: false,
                  })
                }
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {showFinancialModal.type === 'tax' &&
              merchant?.vat_registration_status === 'registered' && (
                <View
                  style={{
                    backgroundColor: `${colors.primary}08`,
                    padding: 16,
                    borderRadius: 16,
                    marginBottom: 20,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: `${colors.primary}20`,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: colors.text,
                        marginBottom: 2,
                      }}
                    >
                      Apply 7.5% VAT
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      Automatic calculation based on subtotal
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setIsVatApplied(!isVatApplied)}
                    style={{
                      width: 52,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isVatApplied
                        ? colors.primary
                        : colors.border,
                      justifyContent: 'center',
                      paddingHorizontal: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: '#fff',
                        alignSelf: isVatApplied ? 'flex-end' : 'flex-start',
                        ...shadows.sm,
                      }}
                    />
                  </Pressable>
                </View>
              )}

            {showFinancialModal.type === 'tax' &&
              merchant?.vat_registration_status !== 'registered' && (
                <Pressable
                  onPress={() => {
                    setShowFinancialModal({
                      ...showFinancialModal,
                      visible: false,
                    });
                    router.push('/tax');
                  }}
                  style={{
                    backgroundColor: `${colors.info}10`,
                    padding: 16,
                    borderRadius: 16,
                    marginBottom: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderWidth: 1,
                    borderColor: `${colors.info}20`,
                  }}
                >
                  <Ionicons
                    name="information-circle"
                    size={24}
                    color={colors.info}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: colors.info,
                      }}
                    >
                      Setup VAT Module
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      Enable automatic VAT at 7.5%
                    </Text>
                  </View>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={colors.info}
                  />
                </Pressable>
              )}

            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                marginBottom: 8,
              }}
            >
              {showFinancialModal.type === 'tax' && isVatApplied
                ? 'Calculated VAT Amount'
                : 'Amount (NGN)'}
            </Text>
            <TextInput
              style={{
                backgroundColor:
                  isVatApplied && showFinancialModal.type === 'tax'
                    ? colors.backgroundLight
                    : colors.inputBg,
                color:
                  isVatApplied && showFinancialModal.type === 'tax'
                    ? colors.textMuted
                    : colors.text,
                padding: 18,
                borderRadius: 16,
                fontSize: 18,
                fontWeight: '600',
                marginBottom: 24,
              }}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={
                showFinancialModal.type === 'tax' && isVatApplied
                  ? formatPrice(calculatedVat)
                  : formatPriceInput(financialValue)
              }
              onChangeText={(text) => {
                const clean = text.replace(/[^0-9.]/g, '');
                setFinancialValue(clean);
              }}
              editable={!(showFinancialModal.type === 'tax' && isVatApplied)}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: colors.inputBg,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  if (showFinancialModal.type === 'discount') setDiscount(0);
                  if (showFinancialModal.type === 'shipping') setShippingFee(0);
                  if (showFinancialModal.type === 'tax') {
                    setTaxes(0);
                    setIsVatApplied(false);
                  }
                  setShowFinancialModal({
                    ...showFinancialModal,
                    visible: false,
                  });
                }}
              >
                <Text style={{ color: colors.error, fontWeight: '600' }}>
                  Clear
                </Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 2,
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  const val = Number.parseFloat(financialValue) || 0;
                  if (showFinancialModal.type === 'discount') setDiscount(val);
                  if (showFinancialModal.type === 'shipping')
                    setShippingFee(val);
                  if (showFinancialModal.type === 'tax' && !isVatApplied)
                    setTaxes(val);
                  setShowFinancialModal({
                    ...showFinancialModal,
                    visible: false,
                  });
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Item Modal */}
      <Modal visible={showEditItemModal} transparent animationType="slide">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowEditItemModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 48,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text
                style={{ fontSize: 22, fontWeight: '800', color: colors.text }}
              >
                Edit item
              </Text>
              <Pressable
                onPress={() => setShowEditItemModal(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={26} color={colors.text} />
              </Pressable>
            </View>

            {/* Info Alert Box */}
            <View
              style={{
                backgroundColor: `${colors.primary}10`,
                padding: 16,
                borderRadius: 12,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: `${colors.primary}20`,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 13,
                  fontWeight: '600',
                  lineHeight: 18,
                }}
              >
                Edits made here apply only to this sale and won’t update your
                store’s inventory
              </Text>
            </View>

            <View style={{ gap: 20, marginBottom: 32 }}>
              {/* Row 1: Price and Quantity */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1.5 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      marginBottom: 6,
                      marginLeft: 4,
                      fontWeight: '600',
                    }}
                  >
                    Price
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.backgroundLight,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: colors.text,
                        marginRight: 4,
                      }}
                    >
                      ₦
                    </Text>
                    <TextInput
                      style={{
                        flex: 1,
                        color: colors.text,
                        paddingVertical: 14,
                        fontSize: 16,
                        fontWeight: '600',
                      }}
                      keyboardType="decimal-pad"
                      value={formatPriceInput(editPriceValue)}
                      onChangeText={(text) => {
                        const clean = text.replace(/[^0-9.]/g, '');
                        if ((clean.match(/\./g) || []).length > 1) return;
                        setEditPriceValue(clean);
                      }}
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      marginBottom: 6,
                      marginLeft: 4,
                      fontWeight: '600',
                    }}
                  >
                    Quantity
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.backgroundLight,
                      borderWidth: 1,
                      borderColor: colors.border,
                      color: colors.text,
                      padding: 14,
                      borderRadius: 12,
                      fontSize: 16,
                      fontWeight: '600',
                    }}
                    keyboardType="number-pad"
                    value={editQtyValue}
                    onChangeText={setEditQtyValue}
                  />
                </View>
              </View>

              {/* Description/Details */}
              <View>
                <TextInput
                  style={{
                    backgroundColor: colors.backgroundLight,
                    borderWidth: 1,
                    borderColor: colors.border,
                    color: colors.text,
                    padding: 16,
                    borderRadius: 12,
                    fontSize: 15,
                    height: 100,
                    textAlignVertical: 'top',
                  }}
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={editDetails}
                  onChangeText={setEditDetails}
                />
              </View>
            </View>

            {/* Footer Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                style={{
                  flex: 1,
                  borderWidth: 1.5,
                  borderColor: colors.error,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  if (editingItem) {
                    setOrderItems((prev) =>
                      prev.filter(
                        (i) => i.product_id !== editingItem.product_id
                      )
                    );
                    setShowEditItemModal(false);
                  }
                }}
              >
                <Text
                  style={{
                    color: colors.error,
                    fontSize: 16,
                    fontWeight: '800',
                  }}
                >
                  Remove
                </Text>
              </Pressable>

              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  if (editingItem) {
                    const finalPrice =
                      Number.parseFloat(editPriceValue.replace(/,/g, '')) || 0;
                    const finalQty = Number.parseInt(editQtyValue, 10) || 1;
                    setOrderItems((prev) =>
                      prev.map((item) =>
                        item.product_id === editingItem.product_id
                          ? {
                              ...item,
                              price: finalPrice,
                              quantity: finalQty,
                              details: editDetails,
                            }
                          : item
                      )
                    );
                  }
                  setShowEditItemModal(false);
                }}
              >
                <Text
                  style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}
                >
                  Save
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.md },

  // List Card Style
  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listLabel: { fontSize: 14, fontWeight: '500' },
  listValue: { fontSize: 14, marginLeft: 'auto' },
  listSubValue: { fontSize: 13, marginTop: 2 },

  // Channel Section
  section: { marginTop: 8 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.7,
  },
  channelScroll: { gap: 8, paddingRight: 16 },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    gap: 6,
  },
  channelText: { fontSize: 13, fontWeight: '600' },

  // Product Section
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowGap: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  actionBtnText: { fontSize: 14, fontWeight: '500' },

  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
  },

  // Item Card
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  itemThumbnail: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary Section
  summaryContainer: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryLabel: { fontSize: 14, fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '600' },

  // Notes
  notesInput: {
    height: 80,
    borderRadius: RADIUS.md,
    padding: 12,
    textAlignVertical: 'top',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 10,
  },
  paymentToggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: RADIUS.lg,
  },
  toggleOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  toggleText: { fontSize: 12, fontWeight: '700' },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 100,
  },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Modal Styles
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    padding: 24,
    borderRadius: 20,
    gap: 16,
    width: '90%',
    alignSelf: 'center',
  },
  dialogTitle: { fontSize: 18, fontWeight: 'bold' },
  dialogInput: { padding: 14, borderRadius: 12 },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  dialogBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  bottomSheet: {
    padding: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  sheetTitle: { fontSize: 20, fontWeight: 'bold' },
  sheetInput: { padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 },
  sheetBtn: {
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  label: { fontSize: 13, fontWeight: '600' },
  input: { padding: 12, borderRadius: 8, fontSize: 16 },
});
