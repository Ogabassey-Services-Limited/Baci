import { Alert } from 'react-native';
import type { Biller, BillItem } from '@/hooks/use-vtu-billers';
import type { useVTUVerify, VerifyResult } from '@/hooks/use-vtu-verify';
import { IDENTIFIER_LABELS } from './bill-form.constants';
import type { BillFormProps } from './bill-form.types';
import { createBillFormVerifyPayload } from './bill-form-verify-payload';

interface CreateBillFormVerifyHandlerInput {
  dismissKeyboard: () => void;
  isBillItemSelectionComplete: boolean;
  normalizedCustomerId: string;
  onVerifySuccess: (data: VerifyResult) => void;
  pendingVerificationKeyRef: { current: string | null };
  requiresBillItemSelection: boolean;
  selectedBiller: Biller | null;
  selectedBillItem: BillItem | null;
  selectedBillItemIdentifier: string | null;
  type: BillFormProps['type'];
  verificationKey: string;
  verify: ReturnType<typeof useVTUVerify>;
}

/**
 * Builds the "Verify" tap handler: it guards on the fields the provider needs,
 * records the in-flight verification key (so a stale response cannot apply to
 * inputs that changed mid-flight), and fires the verify mutation.
 */
export function createBillFormVerifyHandler({
  dismissKeyboard,
  isBillItemSelectionComplete,
  normalizedCustomerId,
  onVerifySuccess,
  pendingVerificationKeyRef,
  requiresBillItemSelection,
  selectedBiller,
  selectedBillItem,
  selectedBillItemIdentifier,
  type,
  verificationKey,
  verify,
}: CreateBillFormVerifyHandlerInput) {
  return () => {
    dismissKeyboard();
    if (
      !selectedBiller ||
      !selectedBillItemIdentifier ||
      !normalizedCustomerId ||
      !isBillItemSelectionComplete
    ) {
      const steps = ['select a provider'];
      if (requiresBillItemSelection) {
        steps.push('complete the available options');
      }
      steps.push(`enter your ${IDENTIFIER_LABELS[type].toLowerCase()}`);
      Alert.alert('Missing Information', `Please ${steps.join(', ')}.`);
      return;
    }
    pendingVerificationKeyRef.current = verificationKey;
    verify.mutate(
      createBillFormVerifyPayload({
        customerIdentifier: normalizedCustomerId,
        selectedBiller,
        selectedBillItem,
        selectedBillItemIdentifier,
      }),
      { onSuccess: onVerifySuccess }
    );
  };
}
