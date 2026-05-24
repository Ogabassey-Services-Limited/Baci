import type { OrderSource, PaymentStatus } from '@baci/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { CountryCode } from 'react-native-country-picker-modal';
import {
  createEmptyCustomerInfo,
  createEmptyCustomItemDraft,
  createEmptyDeliveryInfo,
  createEmptyNewCustomerDraft,
} from '@/components/orders/new-order.defaults';
import { DEFAULT_COUNTRY_CODE } from '@/components/orders/new-order.shared';
import type {
  CustomerInfo,
  OrderItem,
  SelectableCustomer,
  SelectableOrderProduct,
  SelectedParentProduct,
} from '@/components/orders/new-order.types';
import { useAuth } from '@/hooks/useAuth';
import { useBranches } from '@/hooks/useBranches';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useCreateCustomer } from '@/hooks/useCustomers';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { createNewOrderTotals } from '@/lib/new-order-totals';
import { createNewOrderCustomerActions } from './createNewOrderCustomerActions';
import { createNewOrderProductActions } from './createNewOrderProductActions';
import { submitNewOrder } from './submitNewOrder';
import { useNewOrderLookupData } from './useNewOrderLookupData';
import { useNewOrderUiState } from './useNewOrderUiState';
import { useOrderBranchSelection } from './useOrderBranchSelection';
import { useQuickAddProductMatches } from './useQuickAddProductMatches';

export function useNewOrderController() {
  const { colors, shadows } = useTheme();
  const { merchant } = useMerchant();
  const { user } = useAuth();
  const { data: branches = [] } = useBranches();
  const { scope } = useBranchScope();
  const queryClient = useQueryClient();
  const createCustomerMutation = useCreateCustomer();

  // State
  const [date, setDate] = useState(new Date());
  const [selectedChannel, setSelectedChannel] =
    useState<OrderSource>('physical');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [customer, setCustomer] = useState<CustomerInfo>(
    createEmptyCustomerInfo
  );
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
    useState<SelectedParentProduct>(null);
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
  const [newCustomer, setNewCustomer] = useState(createEmptyNewCustomerDraft);
  const [selectedCountryCode, setSelectedCountryCode] =
    useState<CountryCode>(DEFAULT_COUNTRY_CODE);
  const [duplicateCustomer, setDuplicateCustomer] =
    useState<SelectableCustomer | null>(null);
  const { defaultBranchId } = useOrderBranchSelection({
    branches,
    scope,
    setSelectedBranchId,
  });

  // Delivery Details
  const [sameAsCustomer, setSameAsCustomer] = useState(true);
  const [deliveryInfo, setDeliveryInfo] = useState(createEmptyDeliveryInfo);

  const [customItem, setCustomItem] = useState(createEmptyCustomItemDraft);
  const quickAddProductMatchState = useQuickAddProductMatches(customItem);

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

  const productActions = createNewOrderProductActions({
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

  const customerActions = createNewOrderCustomerActions({
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
      selectedBranchId,
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

  const resetOrderDraft = () => {
    setDate(new Date());
    setSelectedChannel('physical');
    setSelectedBranchId(defaultBranchId);
    setPaymentStatus('unpaid');
    setCustomer(createEmptyCustomerInfo());
    setOrderItems([]);
    setNotes('');
    setDiscount(0);
    setShippingFee(0);
    setTaxes(0);
    setIsVatApplied(merchant?.vat_registration_status === 'registered');
    setSameAsCustomer(true);
    setDeliveryInfo(createEmptyDeliveryInfo());
    setPartialAmount('');
    setPaymentMethod('transfer');
    uiState.setLastOrderId(null);
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
    isLoadingQuickAddProductMatches: quickAddProductMatchState.isLoading,
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
    quickAddProductMatches: quickAddProductMatchState.matches,
    refetchProducts,
    refetchSelectedParentProduct,
    sameAsCustomer,
    selectableProductRows,
    branches,
    selectedChannel,
    selectedBranchId,
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
    setSelectedBranchId,
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
    handleSubmit,
    resetOrderDraft,
    ...customerActions,
    ...productActions,
  };
}
