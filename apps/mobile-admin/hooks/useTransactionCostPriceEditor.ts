import { useState } from 'react';
import { Alert } from 'react-native';
import type {
  TransactionReviewItem,
  TransactionReviewOrder,
} from '@/hooks/useTransactionReview';
import { useUpdateTransactionCostPrice } from '@/hooks/useUpdateTransactionCostPrice';
import {
  buildTransactionDateIso,
  formatCostPriceInput,
  formatCostPriceInputText,
  formatTransactionDateInput,
  parseCostPriceInput,
  toSentenceCaseSupplierName,
} from '@/lib/transaction-review';

interface UseTransactionCostPriceEditorOptions {
  currencySymbol: string;
  formatCurrency: (amount: number) => string;
}

function getTransactionItemIdentifier(item: TransactionReviewItem) {
  if (item.identifierType && item.identifierValue) {
    return {
      identifierType: item.identifierType,
      identifierValue: item.identifierValue,
    };
  }

  if (item.imeiValues[0]) {
    return {
      identifierType: 'imei' as const,
      identifierValue: item.imeiValues[0],
    };
  }

  if (item.serialValues[0]) {
    return {
      identifierType: 'serial' as const,
      identifierValue: item.serialValues[0],
    };
  }

  return {
    identifierType: null,
    identifierValue: null,
  };
}

export function useTransactionCostPriceEditor({
  currencySymbol,
  formatCurrency,
}: UseTransactionCostPriceEditorOptions) {
  const updateCostPrice = useUpdateTransactionCostPrice();
  const [selectedItem, setSelectedItem] =
    useState<TransactionReviewItem | null>(null);
  const [selectedOrder, setSelectedOrder] =
    useState<TransactionReviewOrder | null>(null);
  const [costPriceInput, setCostPriceInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [supplierInput, setSupplierInput] = useState('');
  const [updateProductDefault, setUpdateProductDefault] = useState(false);

  const handleOpenEditor = (
    order: TransactionReviewOrder,
    item: TransactionReviewItem
  ) => {
    setSelectedOrder(order);
    setSelectedItem(item);
    setCostPriceInput(formatCostPriceInput(item.costPrice, currencySymbol));
    setDateInput(formatTransactionDateInput(order.createdAt));
    setSupplierInput(toSentenceCaseSupplierName(item.supplierName ?? ''));
    setUpdateProductDefault(false);
    setSaveError(null);
  };

  const handleCloseEditor = () => {
    setSelectedOrder(null);
    setSelectedItem(null);
    setCostPriceInput('');
    setDateInput('');
    setSaveError(null);
    setSupplierInput('');
    setUpdateProductDefault(false);
  };

  const handleChangeCostPrice = (value: string) => {
    setCostPriceInput(formatCostPriceInputText(value, currencySymbol));
  };

  const saveTransactionCostPrice = async ({
    nextCostPrice,
    nextTransactionDateIso,
  }: {
    nextCostPrice: number;
    nextTransactionDateIso: string;
  }) => {
    if (!selectedOrder || !selectedItem) {
      return;
    }

    try {
      const { identifierType, identifierValue } =
        getTransactionItemIdentifier(selectedItem);

      setSaveError(null);
      await updateCostPrice.mutateAsync({
        costPrice: nextCostPrice,
        orderId: selectedOrder.id,
        orderItemId: selectedItem.orderItemId ?? selectedItem.id,
        productId: selectedItem.productId,
        supplierName: toSentenceCaseSupplierName(supplierInput),
        transactionDateIso: nextTransactionDateIso,
        ...(selectedItem.unitIndex == null
          ? {}
          : {
              identifierType,
              identifierValue,
              unitIndex: selectedItem.unitIndex,
            }),
        updateProductDefault,
        variantId: selectedItem.variantId,
      });
      handleCloseEditor();
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not update cost price. Please try again.'
      );
    }
  };

  const handleSave = async () => {
    if (!selectedOrder || !selectedItem) {
      return;
    }

    const nextCostPrice = parseCostPriceInput(costPriceInput);
    if (Number.isNaN(nextCostPrice) || nextCostPrice < 0) {
      setSaveError('Enter a valid cost price (0 or greater).');
      return;
    }

    const nextTransactionDateIso = buildTransactionDateIso(dateInput);
    if (!nextTransactionDateIso) {
      setSaveError('Enter a valid transaction date in YYYY-MM-DD format.');
      return;
    }

    const totalCost = nextCostPrice * selectedItem.quantity;
    if (totalCost > selectedItem.revenue) {
      const lossAmount = totalCost - selectedItem.revenue;

      Alert.alert(
        'Loss detected',
        `This records a loss of ${formatCurrency(lossAmount)} for ${selectedItem.name}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Record loss',
            onPress: () => {
              void saveTransactionCostPrice({
                nextCostPrice,
                nextTransactionDateIso,
              });
            },
            style: 'destructive',
          },
        ]
      );
      return;
    }

    await saveTransactionCostPrice({
      nextCostPrice,
      nextTransactionDateIso,
    });
  };

  return {
    costPriceInput,
    dateInput,
    handleChangeCostPrice,
    handleChangeSupplier: setSupplierInput,
    handleCloseEditor,
    handleOpenEditor,
    handleSave,
    pending: updateCostPrice.isPending,
    saveError,
    selectedItem,
    selectedOrder,
    setDateInput,
    setUpdateProductDefault,
    supplierInput,
    updateProductDefault,
  };
}
