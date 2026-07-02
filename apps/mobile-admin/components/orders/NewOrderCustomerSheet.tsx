import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import type { TextInput as BottomSheetTextInputRef } from 'react-native-gesture-handler';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { NewOrderCustomerCreateView } from './NewOrderCustomerCreateView';
import { NewOrderCustomerSearchFooter } from './NewOrderCustomerSearchFooter';
import { NewOrderCustomerSearchView } from './NewOrderCustomerSearchView';
import { NewOrderProductPickerSheetFrame } from './NewOrderProductPickerSheetFrame';

const CUSTOMER_PICKER_FOOTER_BOTTOM_INSET = 18;
const CUSTOMER_PICKER_LIST_BOTTOM_PADDING = 128;
const CUSTOMER_PICKER_SELECTION_SNAP_POINTS = ['40%', '74%'];

interface NewOrderCustomerSheetProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderCustomerSheet({
  controller,
}: NewOrderCustomerSheetProps) {
  const inputRef = useRef<BottomSheetTextInputRef | null | undefined>(null);
  const {
    colors,
    customerSearch,
    handleCloseCustomerModal,
    isCreatingCustomer,
    resetNewCustomerForm,
    setCustomerSearch,
    setDuplicateCustomer,
    setIsCreatingCustomer,
    showCustomerModal,
  } = controller;
  const customerSearchFooter = !isCreatingCustomer ? (
    <NewOrderCustomerSearchFooter
      autoFocus={showCustomerModal && !isCreatingCustomer}
      colors={colors}
      customerSearch={customerSearch}
      inputRef={inputRef}
      setCustomerSearch={setCustomerSearch}
    />
  ) : null;
  useEffect(() => {
    if (showCustomerModal && !isCreatingCustomer) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 250);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [showCustomerModal, isCreatingCustomer]);

  const handleBackToCustomerSearch = () => {
    setIsCreatingCustomer(false);
    setDuplicateCustomer(null);
    resetNewCustomerForm();
  };

  const createLeadingAccessory = isCreatingCustomer ? (
    <Pressable
      accessibilityLabel="Back to customer search"
      accessibilityRole="button"
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      onPress={handleBackToCustomerSearch}
      style={{
        alignItems: 'center',
        height: 36,
        justifyContent: 'center',
        width: 36,
      }}
    >
      <Ionicons color={colors.text} name="chevron-back" size={24} />
    </Pressable>
  ) : undefined;
  const createTrailingAccessory = isCreatingCustomer ? (
    <Pressable
      accessibilityLabel="Close customer sheet"
      accessibilityRole="button"
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      onPress={handleCloseCustomerModal}
      style={{
        alignItems: 'center',
        backgroundColor: `${colors.text}10`,
        borderRadius: 18,
        height: 36,
        justifyContent: 'center',
        width: 36,
      }}
    >
      <Ionicons color={colors.text} name="close" size={20} />
    </Pressable>
  ) : null;

  return (
    <NewOrderProductPickerSheetFrame
      activeIndex={isCreatingCustomer ? 1 : 0}
      closeLabel="Close customer sheet"
      colors={colors}
      footer={customerSearchFooter}
      leadingAccessory={createLeadingAccessory}
      footerBottomInset={CUSTOMER_PICKER_FOOTER_BOTTOM_INSET}
      onClose={handleCloseCustomerModal}
      // Static snap points (never swap to undefined at runtime): changing the
      // snapPoints array while mounted can desync @gorhom/bottom-sheet's gesture
      // boundaries and lock list scrolling.
      snapPoints={CUSTOMER_PICKER_SELECTION_SNAP_POINTS}
      title={isCreatingCustomer ? 'New Customer' : 'Select Customer'}
      trailingAccessory={createTrailingAccessory}
      visible={showCustomerModal}
    >
      {isCreatingCustomer ? (
        <NewOrderCustomerCreateView controller={controller} />
      ) : (
        <NewOrderCustomerSearchView
          controller={controller}
          listBottomPadding={CUSTOMER_PICKER_LIST_BOTTOM_PADDING}
          showInlineSearch={false}
        />
      )}
    </NewOrderProductPickerSheetFrame>
  );
}
