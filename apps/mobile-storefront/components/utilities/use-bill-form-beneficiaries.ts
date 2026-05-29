import { useEffect, useState } from 'react';
import type { Biller } from '@/hooks/use-vtu-billers';
import {
  filterBeneficiaries,
  getBeneficiaries,
  saveBeneficiary,
  type UtilityBeneficiary,
} from '@/lib/utility-beneficiaries';
import { trackError } from '@/services/analytics';

export interface BillFormBeneficiarySaveRequest {
  authenticatedCustomerId: string | null;
  billerId: string;
  billerName: string;
  billItemIdentifier: string;
  customerId: string;
  customerName: string;
}

interface UseBillFormBeneficiariesInput {
  authenticatedCustomerId: string | null;
  saveRequest: BillFormBeneficiarySaveRequest | null;
  selectedBiller: Biller | null;
  selectedBillItemIdentifier: string | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useBillFormBeneficiaries({
  authenticatedCustomerId,
  saveRequest,
  selectedBiller,
  selectedBillItemIdentifier,
}: UseBillFormBeneficiariesInput): UtilityBeneficiary[] {
  const [allBeneficiaries, setAllBeneficiaries] = useState<
    UtilityBeneficiary[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    getBeneficiaries(authenticatedCustomerId)
      .then((result) => {
        if (!cancelled) {
          setAllBeneficiaries(result);
        }
      })
      .catch((err) => {
        trackError('utility_beneficiaries_load_failed', getErrorMessage(err), {
          authenticatedCustomerId,
        });
        console.error('getBeneficiaries failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [authenticatedCustomerId]);

  useEffect(() => {
    if (
      !saveRequest ||
      saveRequest.authenticatedCustomerId !== authenticatedCustomerId
    ) {
      return;
    }

    const requestUserId = saveRequest.authenticatedCustomerId;
    let cancelled = false;
    saveBeneficiary(requestUserId, {
      billerId: saveRequest.billerId,
      billerName: saveRequest.billerName,
      billItemIdentifier: saveRequest.billItemIdentifier,
      customerId: saveRequest.customerId,
      customerName: saveRequest.customerName,
    })
      .then(() => getBeneficiaries(requestUserId))
      .then((result) => {
        if (!cancelled && requestUserId === authenticatedCustomerId) {
          setAllBeneficiaries(result);
        }
      })
      .catch((err) => {
        trackError('utility_beneficiaries_save_failed', getErrorMessage(err), {
          authenticatedCustomerId: requestUserId,
          billerId: saveRequest.billerId,
          billItemIdentifier: saveRequest.billItemIdentifier,
        });
        console.error(
          'utility-beneficiaries: post-verification save failed',
          err
        );
      });
    return () => {
      cancelled = true;
    };
  }, [authenticatedCustomerId, saveRequest]);

  return selectedBiller && selectedBillItemIdentifier
    ? filterBeneficiaries(
        allBeneficiaries,
        selectedBiller.billerId,
        selectedBillItemIdentifier
      )
    : [];
}
