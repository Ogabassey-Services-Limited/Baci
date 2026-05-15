'use client';

import { useEffect, useRef, useState } from 'react';
import { useVTUHistory } from '@/hooks/use-vtu-history';
import {
  type UtilityRepeatDefaults,
  type UtilityRepeatRecipient,
  utilityRepeatHelpers,
} from '@/lib/utility-repeat';
import { getRouteRepeatDefaults } from './utility-purchase.config';
import type {
  RouteRepeatParams,
  ValidUtilityType,
} from './utility-purchase.types';

interface UseQuickRepeatInput extends RouteRepeatParams {
  currentType: ValidUtilityType | null;
  historyFilter: ValidUtilityType;
  routeType: ValidUtilityType | null;
}

function buildRouteRepeatParams(params: RouteRepeatParams): RouteRepeatParams {
  return { ...params };
}

export function useQuickRepeat({
  currentType,
  historyFilter,
  repeatAmount,
  repeatBillerName,
  repeatBillItemIdentifier,
  repeatCustomerIdentifier,
  repeatCustomerName,
  repeatDataPlanCode,
  repeatNetworkProvider,
  repeatPhoneNumber,
  repeatVerified,
  routeType,
}: UseQuickRepeatInput) {
  const [repeatDefaults, setRepeatDefaults] = useState<UtilityRepeatDefaults>(
    () =>
      routeType && currentType === routeType
        ? getRouteRepeatDefaults(
            buildRouteRepeatParams({
              repeatAmount,
              repeatBillerName,
              repeatBillItemIdentifier,
              repeatCustomerIdentifier,
              repeatCustomerName,
              repeatDataPlanCode,
              repeatNetworkProvider,
              repeatPhoneNumber,
              repeatVerified,
            })
          )
        : {}
  );
  const [repeatRevision, setRepeatRevision] = useState(0);
  const didInitializeRef = useRef(false);
  const { data: recentTransactions } = useVTUHistory(historyFilter, 5);

  useEffect(() => {
    if (!didInitializeRef.current) {
      didInitializeRef.current = true;
      return;
    }

    setRepeatDefaults(
      routeType && currentType === routeType
        ? getRouteRepeatDefaults(
            buildRouteRepeatParams({
              repeatAmount,
              repeatBillerName,
              repeatBillItemIdentifier,
              repeatCustomerIdentifier,
              repeatCustomerName,
              repeatDataPlanCode,
              repeatNetworkProvider,
              repeatPhoneNumber,
              repeatVerified,
            })
          )
        : {}
    );
    setRepeatRevision(0);
  }, [
    currentType,
    routeType,
    repeatAmount,
    repeatBillerName,
    repeatBillItemIdentifier,
    repeatCustomerIdentifier,
    repeatCustomerName,
    repeatDataPlanCode,
    repeatNetworkProvider,
    repeatPhoneNumber,
    repeatVerified,
  ]);

  const recentRecipients = utilityRepeatHelpers.getRecentRecipients(
    recentTransactions,
    currentType ?? historyFilter
  );

  const handleRecipientSelect = (recipient: UtilityRepeatRecipient) => {
    setRepeatDefaults(recipient.defaults);
    setRepeatRevision((current) => current + 1);
  };

  return {
    handleRecipientSelect,
    isRepeatPaymentReady: Boolean(repeatDefaults.isVerified),
    recentRecipients,
    repeatDefaults,
    repeatRevision,
  };
}
