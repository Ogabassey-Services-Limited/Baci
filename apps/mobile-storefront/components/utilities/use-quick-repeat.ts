'use client';

import { useEffect, useRef, useState } from 'react';
import { useVTUHistory } from '@/hooks/use-vtu-history';
import {
  type UtilityRepeatDefaults,
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
  isKeyboardVisible: boolean;
  routeType: ValidUtilityType | null;
  title: string;
}

function buildRouteRepeatParams(params: RouteRepeatParams): RouteRepeatParams {
  return { ...params };
}

export function useQuickRepeat({
  currentType,
  historyFilter,
  isKeyboardVisible,
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
  title,
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
  const [isQuickRepeatDismissed, setIsQuickRepeatDismissed] = useState(false);
  const didInitializeRef = useRef(false);
  const {
    data: recentTransactions,
    error: recentTransactionsError,
    isLoading: isRecentTransactionsLoading,
  } = useVTUHistory(historyFilter, 5);

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
    setIsQuickRepeatDismissed(false);
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

  const lastTransaction =
    recentTransactions?.find(
      (transaction) =>
        transaction.status === 'successful' &&
        utilityRepeatHelpers.getRouteType(transaction.type) === currentType
    ) ?? null;
  const showQuickRepeat = Boolean(
    lastTransaction &&
      !isRecentTransactionsLoading &&
      !recentTransactionsError &&
      !isKeyboardVisible &&
      !isQuickRepeatDismissed
  );

  let quickRepeatNotice: string | null = null;
  if (!isKeyboardVisible && !isQuickRepeatDismissed) {
    if (isRecentTransactionsLoading) {
      quickRepeatNotice = `Checking recent ${title} transactions...`;
    } else if (recentTransactionsError) {
      quickRepeatNotice = `Recent ${title} transactions unavailable.`;
    }
  }

  const handleQuickRepeat = () => {
    if (!lastTransaction) {
      return;
    }

    setRepeatDefaults(utilityRepeatHelpers.getDefaults(lastTransaction));
    setRepeatRevision((current) => current + 1);
    setIsQuickRepeatDismissed(true);
  };

  return {
    handleQuickRepeat,
    isRecentTransactionsLoading,
    isRepeatPaymentReady: Boolean(repeatDefaults.isVerified),
    lastTransaction,
    quickRepeatNotice,
    repeatDefaults,
    repeatRevision,
    showQuickRepeat,
  };
}
