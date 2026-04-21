import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { OrderSource, PaymentStatus } from '@baci/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { CountryCode } from 'react-native-country-picker-modal';
import { useAuth } from '@/hooks/useAuth';
import { useCreateCustomer } from '@/hooks/useCustomers';
import { useMerchant } from '@/hooks/useMerchant';
import type { Product } from '@/hooks/useProducts';
import { useTheme } from '@/hooks/useTheme';
import {
  createEmptyCustomerInfo,
  createEmptyCustomItemDraft,
  createEmptyDeliveryInfo,
  createEmptyNewCustomerDraft,
} from '@/components/orders/new-order.defaults';
import type {
  CustomerInfo,
  OrderItem,
  SelectableCustomer,
  SelectableOrderProduct,
} from '@/components/orders/new-order.types';
import { DEFAULT_COUNTRY_CODE } from '@/components/orders/new-order.shared';
import { createNewOrderTotals } from '@/lib/new-order-totals';
import { createNewOrderCustomerActions } from './createNewOrderCustomerActions';
import { createNewOrderProductActions } from './createNewOrderProductActions';
import { useNewOrderLookupData } from './useNewOrderLookupData';
import { useNewOrderUiState } from './useNewOrderUiState';
import { submitNewOrder } from './submitNewOrder';

export function useNewOrderController() {
  const { colors, shadows } = useTheme();
  const { merchant } = useMerchant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createCustomerMutation = useCreateCustomer();

  // State
  const [date, setDate] = useState(new Date());
  const [selectedChannel, setSelectedChannel] =
    useState<OrderSource>('physical');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [customer, setCustomer] = useState<CustomerInfo>(createEmptyCustomerInfo);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref-based flag to prevent duplicate submissions (guards against race conditions)
  const isSubmittingRef = useRef(false);

  const uiState = useNewOrderUiState();

  const [discount, setDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [taxes, setTaxes] = useState(0);
  const [isVatApplied, setIsVatApplied] = useState(false);

  // Search & Form
  const [productSearch, setProductSearch] = useState('');
  const [selectedParentProduct, setSelectedParentProduct] =
    useState<Product | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const {
    customersData,
    customersQuery,
    productPicker,
    selectedParentProductVariantsQuery,
  } = useNewOrderLookupData({
    customerSearch,
    productSearch,
    selectedParentProduct,
  });
  const {
    error: productsError,
    fetchNextPage: fetchMoreProducts,
    hasNextPage: hasMoreProducts,
    isFetchingNextPage: isFetchingMoreProducts,
    isLoading: isProductsLoading,
    products: filteredProducts,
    refetch: refetchProducts,
  } = productPicker;
  const {
    data: selectedParentProductVariantsData,
    error: selectedParentProductError,
    isLoading: isLoadingSelectedParentProduct,
    refetch: refetchSelectedParentProduct,
  } = selectedParentProductVariantsQuery;
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] =
    useState(createEmptyNewCustomerDraft);
  const [selectedCountryCode, setSelectedCountryCode] =
    useState<CountryCode>(DEFAULT_COUNTRY_CODE);
  const [duplicateCustomer, setDuplicateCustomer] =
    useState<SelectableCustomer | null>(null);

  // Delivery Details
  const [sameAsCustomer, setSameAsCustomer] = useState(true);
  const [deliveryInfo, setDeliveryInfo] = useState(createEmptyDeliveryInfo);

  const [customItem, setCustomItem] = useState(createEmptyCustomItemDraft);

  // Initialize VAT status from merchant
  useEffect(() => {
    if (merchant?.vat_registration_status === 'registered') {
      setIsVatApplied(true);
    }
  }, [merchant?.vat_registration_status]);

  const [partialAmount, setPartialAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transfer');

  const { calculatedVat, formatPrice, subtotal, taxesToUse, total, vatRate } =
    createNewOrderTotals({
      discount,
      isVatApplied,
      merchantCurrency: merchant?.payout_currency,
      merchantVatRate: merchant?.vat_rate,
      orderItems,
      shippingFee,
      taxes,
    });
  const isPickingVariant = selectedParentProduct !== null;
  const selectableProductRows: SelectableOrderProduct[] = isPickingVariant
    ? (selectedParentProductVariantsData ?? [])
    : filteredProducts;

  const {
    closeProductModal,
    handleAddCustomItem,
    handleAddProduct,
    handleQuantityChange,
    handleSelectProduct,
    resetProductPickerState,
  } = createNewOrderProductActions({
    customItem,
    orderItems,
    selectedParentProduct,
    setCustomItem,
    setOrderItems,
    setProductSearch,
    setSelectedParentProduct,
    setShowCustomItemModal: uiState.setShowCustomItemModal,
    setShowProductModal: uiState.setShowProductModal,
  });

  const {
    handleCloseCustomerModal,
    handleCreateCustomer,
    handleSelectCustomer,
    resetNewCustomerForm,
  } = createNewOrderCustomerActions({
    createCustomer: createCustomerMutation.mutateAsync,
    merchantId: merchant?.id,
    newCustomer,
    setCustomer,
    setCustomerSearch,
    setDuplicateCustomer,
    setIsCreatingCustomer,
    setNewCustomer,
    setSelectedCountryCode,
    setShowCustomerModal: uiState.setShowCustomerModal,
  });

  const handleSubmit = async () => {
    await submitNewOrder({
      customer,
      deliveryInfo,
      discount,
      merchantCurrency: merchant?.payout_currency,
      merchantId: merchant?.id,
      notes,
      orderItems,
      partialAmount,
      paymentMethod,
      paymentStatus,
      queryClient,
      sameAsCustomer,
      selectedChannel,
      setIsSubmitting,
      setLastOrderId: uiState.setLastOrderId,
      setShowSuccessModal: uiState.setShowSuccessModal,
      shippingFee,
      subtotal,
      submittingRef: isSubmittingRef,
      taxesToUse,
      total,
      userId: user?.id,
    });
  };

  return {
    colors,
    createCustomerMutation,
    customer,
    customerSearch,
    customersData,
    customersQuery,
    customItem,
    date,
    deliveryInfo,
    discount,
    duplicateCustomer,
    fetchMoreProducts,
    filteredProducts,
    hasMoreProducts,
    isCreatingCustomer,
    isFetchingMoreProducts,
    isLoadingSelectedParentProduct,
    isProductsLoading,
    isPickingVariant,
    isSubmitting,
    isVatApplied,
    merchant,
    newCustomer,
    notes,
    orderItems,
    partialAmount,
    paymentMethod,
    paymentStatus,
    productsError,
    productSearch,
    refetchProducts,
    refetchSelectedParentProduct,
    sameAsCustomer,
    selectableProductRows,
    selectedChannel,
    selectedCountryCode,
    selectedParentProduct,
    selectedParentProductError,
    ...uiState,
    setCustomer,
    setCustomerSearch,
    setCustomItem,
    setDate,
    setDeliveryInfo,
    setDiscount,
    setDuplicateCustomer,
    setIsCreatingCustomer,
    setIsVatApplied,
    setNewCustomer,
    setNotes,
    setOrderItems,
    setPartialAmount,
    setPaymentMethod,
    setPaymentStatus,
    setProductSearch,
    setSameAsCustomer,
    setSelectedChannel,
    setSelectedCountryCode,
    setSelectedParentProduct,
    setShippingFee,
    setTaxes,
    shadows,
    shippingFee,
    subtotal,
    taxes,
    taxesToUse,
    total,
    vatRate,
    calculatedVat,
    formatPrice,
    handleAddCustomItem,
    handleAddProduct,
    handleCloseCustomerModal,
    handleCreateCustomer,
    handleQuantityChange,
    handleSelectCustomer,
    handleSelectProduct,
    handleSubmit,
    closeProductModal,
    resetNewCustomerForm,
    resetProductPickerState,
  };
}
