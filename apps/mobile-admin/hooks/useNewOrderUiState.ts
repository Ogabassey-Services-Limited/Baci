import { useState } from 'react';
import type { FinancialModalState, OrderItem } from '@/components/orders/new-order.types';

export function useNewOrderUiState() {
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
  const [showFinancialModal, setShowFinancialModal] = useState<FinancialModalState>({
    type: 'discount',
    visible: false,
  });
  const [financialValue, setFinancialValue] = useState('');

  return {
    editDetails,
    editingItem,
    editPriceValue,
    editQtyValue,
    financialValue,
    lastOrderId,
    setEditDetails,
    setEditingItem,
    setEditPriceValue,
    setEditQtyValue,
    setFinancialValue,
    setLastOrderId,
    setShowCustomerModal,
    setShowCustomItemModal,
    setShowDatePicker,
    setShowEditItemModal,
    setShowFinancialModal,
    setShowProductModal,
    setShowSuccessModal,
    showCustomerModal,
    showCustomItemModal,
    showDatePicker,
    showEditItemModal,
    showFinancialModal,
    showProductModal,
    showSuccessModal,
  };
}
