import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  OrderGiglFundingPoller,
  type OrderGiglPollContext,
} from '@/lib/order-gigl-funding-poller';
import {
  getMerchantWalletSummary,
  getOrderGiglQuote,
  type OrderGiglMissingField,
  type OrderGiglQuote,
  type OrderGiglReceiver,
  OrderGiglShippingError,
} from '@/lib/order-gigl-shipping';
import {
  invalidateOrderGiglFundingQueries,
  isOrderGiglQuoteFresh,
  type OrderGiglShippingParams,
  type OrderGiglShippingState,
  type OrderGiglWalletState,
  toCompleteOrderGiglReceiver,
  toOrderGiglAddressDraft,
  toOrderGiglWalletState,
} from '@/lib/order-gigl-shipping-state';
import { useOrderGiglFunding } from './useOrderGiglFunding';

export type { OrderGiglShippingState } from '@/lib/order-gigl-shipping-state';

export function useOrderGiglShipping({
  enabled,
  initialAddress,
  orderId,
  preview = false,
}: OrderGiglShippingParams) {
  const queryClient = useQueryClient();
  const [quote, setQuote] = useState<OrderGiglQuote | null>(null);
  const quoteRef = useRef<OrderGiglQuote | null>(null);
  const [wallet, setWallet] = useState<OrderGiglWalletState | null>(null);
  const walletRef = useRef<OrderGiglWalletState | null>(null);
  const [addressDraft, setAddressDraft] = useState<Partial<OrderGiglReceiver>>(
    toOrderGiglAddressDraft(initialAddress)
  );
  const addressRef = useRef(addressDraft);
  const [missingFields, setMissingFields] = useState<OrderGiglMissingField[]>(
    []
  );
  const [state, setState] = useState<OrderGiglShippingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const pollerRef = useRef<OrderGiglFundingPoller | null>(null);
  const confirmationRef = useRef(false);
  const enabledRef = useRef(enabled);
  const previewRef = useRef(preview);
  const appActiveRef = useRef(true);
  const orderIdRef = useRef(orderId);
  const requestQuoteRef = useRef<(() => Promise<unknown>) | null>(null);
  const {
    fundingAccount,
    refreshFundingAccount,
    reset: resetFunding,
    startFunding,
  } = useOrderGiglFunding({
    enabled: enabled && !preview,
    orderId,
    setError,
    setState,
  });

  enabledRef.current = enabled;
  previewRef.current = preview;
  quoteRef.current = quote;

  const stopPolling = () => {
    pollerRef.current?.stop();
    pollerRef.current = null;
    controllerRef.current?.abort();
  };

  const invalidateQuote = () => {
    setQuote(null);
    quoteRef.current = null;
    setWallet(null);
    walletRef.current = null;
  };

  const applyQuoteResult = (
    result: Awaited<ReturnType<typeof getOrderGiglQuote>>
  ) => {
    setQuote(result.quote);
    quoteRef.current = result.quote;
    const nextWallet = toOrderGiglWalletState(result);
    setWallet(nextWallet);
    walletRef.current = nextWallet;
    setMissingFields([]);
    setError(null);
    setState('ready');
  };

  const requestQuote = async (isValid: () => boolean = () => true) => {
    if (!enabledRef.current || !orderId) return null;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState('loading');
    setError(null);
    try {
      const receiver = toCompleteOrderGiglReceiver(addressRef.current);
      const result = previewRef.current
        ? await getOrderGiglQuote(orderId, receiver, controller.signal, true)
        : await getOrderGiglQuote(orderId, receiver, controller.signal);
      if (!controller.signal.aborted && isValid()) {
        applyQuoteResult(result);
        return result;
      }
    } catch (requestError: unknown) {
      if (controller.signal.aborted || !isValid()) return;
      if (
        requestError instanceof OrderGiglShippingError ||
        (requestError &&
          typeof requestError === 'object' &&
          'code' in requestError)
      ) {
        const typed = requestError as OrderGiglShippingError;
        if (typed.code === 'ORDER_SHIPPING_ADDRESS_INCOMPLETE') {
          invalidateQuote();
          setMissingFields(typed.missing ?? []);
          setState('missing_address');
          return;
        }
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'GIG shipping is temporarily unavailable.'
      );
      setState('error');
    }
    return null;
  };
  requestQuoteRef.current = requestQuote;

  const updateAddressField = (field: OrderGiglMissingField, value: string) => {
    setAddressDraft((previous) => {
      const next = { ...previous, [field]: value };
      addressRef.current = next;
      return next;
    });
    invalidateQuote();
  };

  const refreshBalance = async (context?: OrderGiglPollContext) => {
    const isCurrent = () =>
      !context ||
      (context.isCurrent() && enabledRef.current && appActiveRef.current);
    const summary = await getMerchantWalletSummary(context?.signal);
    if (!isCurrent()) return null;
    const price = quoteRef.current?.price ?? 0;
    const shortfall = Math.max(0, price - summary.availableBalance);
    const next = {
      availableBalance: summary.availableBalance,
      canBook: price > 0 && shortfall === 0,
      shortfall,
    };
    setWallet(next);
    walletRef.current = next;
    if (next.canBook) {
      setWallet({ ...next, canBook: false });
      walletRef.current = { ...next, canBook: false };
      if (!isCurrent()) return null;
      const refreshed = await requestQuote(isCurrent);
      if (!isCurrent()) return null;
      if (refreshed?.canBook) {
        invalidateOrderGiglFundingQueries(queryClient, orderId);
      }
      return refreshed ? toOrderGiglWalletState(refreshed) : walletRef.current;
    }
    return next;
  };

  const ensureFreshQuoteForConfirmation = async () => {
    if (
      confirmationRef.current ||
      !quoteRef.current ||
      !walletRef.current?.canBook
    ) {
      return false;
    }
    if (isOrderGiglQuoteFresh(quoteRef.current)) return true;
    confirmationRef.current = true;
    try {
      await requestQuote();
      return false;
    } finally {
      confirmationRef.current = false;
    }
  };

  const startTransferPoll = () => {
    stopPolling();
    if (!enabledRef.current || !appActiveRef.current || !quoteRef.current)
      return;
    setState('polling');
    const poller = new OrderGiglFundingPoller(
      async (context) => {
        try {
          const next = await refreshBalance(context);
          return next?.canBook ? 'stop' : 'continue';
        } catch (pollError: unknown) {
          if (!context.isCurrent()) return 'stop';
          setError(
            pollError instanceof Error
              ? pollError.message
              : 'Unable to refresh wallet balance.'
          );
          setState('error');
          return 'stop';
        }
      },
      () => {
        if (enabledRef.current && appActiveRef.current) setState('ready');
      }
    );
    pollerRef.current = poller;
    poller.start();
  };

  const reset = () => {
    resetFunding();
    controllerRef.current?.abort();
    stopPolling();
    setError(null);
    setMissingFields([]);
    setState('idle');
  };

  const clearOrderScopedState = () => {
    reset();
    invalidateQuote();
    confirmationRef.current = false;
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is render-local and orderId is the state boundary
  useLayoutEffect(() => {
    if (orderIdRef.current === orderId) return;
    orderIdRef.current = orderId;
    clearOrderScopedState();
  }, [orderId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scalar dependencies prevent a render loop while keeping the draft current
  useLayoutEffect(() => {
    const next = toOrderGiglAddressDraft(initialAddress);
    setAddressDraft(next);
    addressRef.current = next;
  }, [
    initialAddress?.address,
    initialAddress?.city,
    initialAddress?.phone,
    initialAddress?.state,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: request functions are render-local and including them would repeat the network request
  useEffect(() => {
    if (enabled) {
      invalidateQuote();
      resetFunding();
      void requestQuote();
    } else reset();
    return () => {
      controllerRef.current?.abort();
      stopPolling();
    };
  }, [enabled, orderId, preview]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stopPolling only mutates stable refs
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appActiveRef.current = nextState === 'active';
      if (!appActiveRef.current) {
        stopPolling();
        setState((previous) =>
          previous === 'loading' || previous === 'polling' ? 'ready' : previous
        );
      } else if (enabledRef.current && !quoteRef.current) {
        void requestQuoteRef.current?.();
      }
    });
    return () => subscription.remove();
  }, []);

  return {
    addressDraft,
    error,
    ensureFreshQuoteForConfirmation,
    fundingAccount,
    missingFields,
    quote,
    refreshBalance,
    refreshFundingAccount,
    requestQuote,
    reset,
    startFunding,
    startTransferPoll,
    state,
    updateAddressField,
    wallet,
  };
}
