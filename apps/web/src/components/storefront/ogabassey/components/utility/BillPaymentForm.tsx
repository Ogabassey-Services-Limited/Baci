'use client';

import { useState, type FormEvent } from 'react';
import { BILL_PAYMENT_COPY } from './bill-payment-form-copy';
import {
  type BillItem,
  getResolvedBillItemCodes,
  resolveBillItemSelection,
  updateBillItemSelection,
} from './bill-item-selection';
import { BillPaymentCheckoutActions } from './BillPaymentCheckoutActions';
import {
  type Biller,
  BillPaymentBillerList,
} from './BillPaymentBillerList';
import { BillPaymentCustomerIdentifier } from './BillPaymentCustomerIdentifier';
import { BillItemLevelOptions } from './BillItemLevelOptions';
import { useBillPaymentBillers } from './useBillPaymentBillers';
import {
  type BillPaymentVerifyPayload,
  useBillPaymentVerification,
} from './useBillPaymentVerification';

interface BillPaymentFormProps {
  type: 'tv' | 'power' | 'betting';
  loading: boolean;
  onSubmit: (data: {
    amount: number;
    billItemIdentifier: string;
    billerCode?: string;
    customerIdentifier: string;
    billerName: string;
    productCode?: string;
    provider?: 'kuda' | 'monnify';
    requireValidationRef?: boolean;
    type: string;
    validationReference?: string;
  }) => void;
}

export function BillPaymentForm({
  type,
  loading,
  onSubmit,
}: BillPaymentFormProps) {
  // Remount the fields when the bill type tab changes so every piece of form
  // state (selection, identifiers, amount, in-flight verification) resets
  // without an effect round-trip.
  // https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes
  return (
    <BillPaymentFormFields
      key={type}
      type={type}
      loading={loading}
      onSubmit={onSubmit}
    />
  );
}

function BillPaymentFormFields({
  type,
  loading,
  onSubmit,
}: BillPaymentFormProps) {
  const { billers, billersError, billersLoading } =
    useBillPaymentBillers(type);
  const { setVerification, verification, verify, verifying } =
    useBillPaymentVerification();
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);
  const [selectedBillItemCodes, setSelectedBillItemCodes] = useState<string[]>(
    []
  );
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');

  const billItemSelection = resolveBillItemSelection(
    selectedBiller?.billItems,
    selectedBillItemCodes
  );
  const selectedBillItem = billItemSelection.leaf;
  const selectedBillItemPathLabel = billItemSelection.selectedPath
    .map((item) => item.itemName)
    .join(' / ');
  const requiresBillItemSelection = billItemSelection.levels.length > 0;
  const selectedBillItemIdentifier = requiresBillItemSelection
    ? selectedBillItem?.itemCode
    : selectedBiller?.billerId;
  // Kuda-display + Monnify-fulfillment: a folded electricity item carries the
  // matching Monnify codes — verify/vend through Monnify (instant) using them.
  const foldedMonnifyBillerCode = selectedBillItem?.monnifyBillerCode;
  const foldedMonnifyProductCode = selectedBillItem?.monnifyProductCode;
  const useFoldedMonnify = Boolean(
    foldedMonnifyBillerCode && foldedMonnifyProductCode
  );
  const selectedProvider = useFoldedMonnify
    ? 'monnify'
    : (selectedBillItem?.provider ?? selectedBiller?.provider ?? 'kuda');
  const selectedBillerCode = useFoldedMonnify
    ? foldedMonnifyBillerCode
    : (selectedBillItem?.billerCode ?? selectedBiller?.billerCode);
  const selectedProductCode = useFoldedMonnify
    ? foldedMonnifyProductCode
    : selectedProvider === 'monnify'
      ? (selectedBillItem?.productCode ?? selectedBillItem?.itemCode)
      : undefined;
  const currentVerificationKey = [
    selectedProvider,
    selectedBiller?.billerId ?? '',
    selectedBillerCode ?? '',
    selectedProductCode ?? '',
    selectedBillItemIdentifier ?? '',
    customerId.trim(),
  ].join('|');
  const visibleVerification =
    verification?.inputKey === currentVerificationKey ? verification : null;
  const isVerificationCurrent =
    visibleVerification?.inputKey === currentVerificationKey;
  const isBillItemSelectionComplete =
    !requiresBillItemSelection || billItemSelection.isComplete;
  const isFixedAmount = selectedBillItem?.isAmountFixed ?? false;

  const handleBillerSelect = (biller: Biller) => {
    const nextCodes = getResolvedBillItemCodes(biller.billItems);
    const nextSelection = resolveBillItemSelection(biller.billItems, nextCodes);

    setSelectedBiller(biller);
    setSelectedBillItemCodes(nextCodes);
    setAmount(
      nextSelection.leaf?.isAmountFixed && nextSelection.leaf.amount > 0
        ? String(nextSelection.leaf.amount)
        : ''
    );
    setVerification(null);
  };

  const handleBillItemSelect = (depth: number, billItem: BillItem) => {
    if (!selectedBiller) {
      return;
    }

    const nextCodes = updateBillItemSelection(
      selectedBiller.billItems,
      selectedBillItemCodes,
      depth,
      billItem.itemCode
    );
    const nextSelection = resolveBillItemSelection(
      selectedBiller.billItems,
      nextCodes
    );

    setSelectedBillItemCodes(nextCodes);
    setAmount(
      nextSelection.leaf?.isAmountFixed && nextSelection.leaf.amount > 0
        ? String(nextSelection.leaf.amount)
        : ''
    );
    setVerification(null);
  };

  const handleVerify = () => {
    if (!selectedBiller || !selectedBillItemIdentifier || !customerId) return;

    let verifyPayload: BillPaymentVerifyPayload;
    if (selectedProvider === 'monnify') {
      const monnifyBillerCode = selectedBillerCode;
      const monnifyProductCode = selectedProductCode;
      if (!monnifyBillerCode || !monnifyProductCode) {
        setVerification({
          verified: false,
          inputKey: currentVerificationKey,
          message: 'Selected bill product is missing Monnify details',
        });
        return;
      }
      verifyPayload = {
        provider: 'monnify',
        billerCode: monnifyBillerCode,
        productCode: monnifyProductCode,
        customerIdentifier: customerId,
      };
    } else {
      verifyPayload = {
        provider: 'kuda',
        billItemIdentifier: selectedBillItemIdentifier,
        customerIdentifier: customerId,
      };
    }
    void verify(verifyPayload, currentVerificationKey);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (
      !selectedBiller ||
      !selectedBillItemIdentifier ||
      !visibleVerification?.verified ||
      !isVerificationCurrent ||
      !amount
    ) {
      return;
    }
    if (
      selectedProvider === 'monnify' &&
      (!selectedBillerCode || !selectedProductCode)
    ) {
      setVerification({
        verified: false,
        inputKey: currentVerificationKey,
        message: 'Selected bill product is missing Monnify details',
      });
      return;
    }
    if (
      selectedProvider === 'monnify' &&
      visibleVerification.requireValidationRef &&
      !visibleVerification.validationReference
    ) {
      setVerification({
        verified: false,
        inputKey: currentVerificationKey,
        message: 'Please verify this bill again before paying.',
      });
      return;
    }
    onSubmit({
      amount: Number(amount),
      billItemIdentifier: selectedBillItemIdentifier,
      ...(selectedProvider === 'monnify'
        ? {
            provider: 'monnify' as const,
            billerCode: selectedBillerCode,
            productCode: selectedProductCode,
            validationReference: visibleVerification.validationReference,
            requireValidationRef:
              visibleVerification.requireValidationRef ?? false,
          }
        : { provider: 'kuda' as const }),
      customerIdentifier: customerId,
      billerName: selectedBillItemPathLabel
        ? `${selectedBiller.billerName} - ${selectedBillItemPathLabel}`
        : selectedBiller.billerName,
      type: BILL_PAYMENT_COPY.tabToBillType[type],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <BillPaymentBillerList
        billers={billers}
        isLoading={billersLoading}
        label={BILL_PAYMENT_COPY.typeLabels[type]}
        selectedBillerId={selectedBiller?.billerId}
        onSelect={handleBillerSelect}
      />
      {billersError && (
        <p
          className="text-sm font-medium text-[var(--store-primary)]"
          role="alert"
        >
          {billersError}
        </p>
      )}

      {selectedBiller &&
        billItemSelection.levels.map((level) => (
          <BillItemLevelOptions
            key={`${selectedBiller.billerId}-${level.depth}`}
            label={
              level.depth === 0
                ? BILL_PAYMENT_COPY.billItemLabels[type]
                : `Additional Option ${level.depth}`
            }
            level={level}
            onSelect={handleBillItemSelect}
          />
        ))}

      {selectedBiller && isBillItemSelectionComplete && (
        <BillPaymentCustomerIdentifier
          customerId={customerId}
          isVerifyDisabled={!customerId || !selectedBillItemIdentifier}
          label={BILL_PAYMENT_COPY.identifierLabels[type]}
          onCustomerIdChange={(nextCustomerId) => {
            setCustomerId(nextCustomerId);
            setVerification(null);
          }}
          onVerify={handleVerify}
          placeholder={BILL_PAYMENT_COPY.identifierPlaceholders[type]}
          verifying={verifying}
        />
      )}

      <BillPaymentCheckoutActions
        amount={amount}
        isFixedAmount={isFixedAmount}
        isVerificationCurrent={isVerificationCurrent}
        loading={loading}
        onAmountChange={setAmount}
        verification={visibleVerification}
        verifying={verifying}
      />

      <p className="text-center text-xs text-gray-400">
        Secured utility checkout
      </p>
    </form>
  );
}
