'use client';

import { useState } from 'react';
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

const RECENT_RECIPIENT_HISTORY_LIMIT = 20;

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
  repeatCustomerAddress,
  repeatDataPlanCode,
  repeatNetworkProvider,
  repeatPhoneNumber,
  repeatVerified,
  routeType,
}: UseQuickRepeatInput) {
  const routeRepeatParams = buildRouteRepeatParams({
    repeatAmount,
    repeatBillerName,
    repeatBillItemIdentifier,
    repeatCustomerIdentifier,
    repeatCustomerName,
    repeatCustomerAddress,
    repeatDataPlanCode,
    repeatNetworkProvider,
    repeatPhoneNumber,
    repeatVerified,
  });
  const routeRepeatSignature = JSON.stringify([
    currentType,
    routeType,
    routeRepeatParams,
  ]);
  const resolveRouteRepeatDefaults = (): UtilityRepeatDefaults =>
    routeType && currentType === routeType
      ? getRouteRepeatDefaults(routeRepeatParams)
      : {};

  const [repeatDefaults, setRepeatDefaults] = useState<UtilityRepeatDefaults>(
    resolveRouteRepeatDefaults
  );
  const [repeatRevision, setRepeatRevision] = useState(0);
  const [prevRouteRepeatSignature, setPrevRouteRepeatSignature] =
    useState(routeRepeatSignature);
  const { data: recentTransactions } = useVTUHistory(
    historyFilter,
    RECENT_RECIPIENT_HISTORY_LIMIT
  );

  // Adjust state during render (with a prev comparison) instead of in an
  // effect, so route-param changes never paint a stale frame first.
  if (routeRepeatSignature !== prevRouteRepeatSignature) {
    setPrevRouteRepeatSignature(routeRepeatSignature);
    setRepeatDefaults(resolveRouteRepeatDefaults());
    setRepeatRevision(0);
  }

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
