import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  getMerchantWalletFundingAccount,
  getMerchantWalletSummary,
  getOrderGiglQuote,
  type MerchantWalletFundingAccount,
  type OrderGiglMissingField,
  type OrderGiglQuote,
  type OrderGiglReceiver,
  OrderGiglShippingError,
  requestMerchantWalletFundingAccount,
} from '@/lib/order-gigl-shipping';
import {
  GIGL_MAX_POLL_COUNT,
  GIGL_POLL_INTERVAL_MS,
  isOrderGiglQuoteFresh,
  type OrderGiglShippingParams,
  type OrderGiglShippingState,
  type OrderGiglWalletState,
  toCompleteOrderGiglReceiver,
  toOrderGiglAddressDraft,
} from '@/lib/order-gigl-shipping-state';

export type { OrderGiglShippingState } from '@/lib/order-gigl-shipping-state';

export function useOrderGiglShipping({
  enabled,
  initialAddress,
  orderId,
}: OrderGiglShippingParams) {
  const queryClient = useQueryClient();
  const [quote, setQuote] = useState<OrderGiglQuote | null>(null);
  const quoteRef = useRef<OrderGiglQuote | null>(null);
  const [wallet, setWallet] = useState<OrderGiglWalletState | null>(null);
  const walletRef = useRef<OrderGiglWalletState | null>(null);
  const [fundingAccount, setFundingAccount] =
    useState<MerchantWalletFundingAccount | null>(null);
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const confirmationRef = useRef(false);
  const fundingRef = useRef(false);
  const enabledRef = useRef(enabled);

  enabledRef.current = enabled;
  quoteRef.current = quote;

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    pollCountRef.current = 0;
  };

  const invalidateFundingQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order-counts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['merchant-wallet'] });
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
    const nextWallet = {
      availableBalance: result.availableBalance,
      canBook: result.canBook,
      shortfall: result.shortfall,
    };
    setWallet(nextWallet);
    walletRef.current = nextWallet;
    setMissingFields([]);
    setError(null);
    setState('ready');
  };

  const requestQuote = async () => {
    if (!enabledRef.current || !orderId) return null;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState('loading');
    setError(null);
    try {
      const result = await getOrderGiglQuote(
        orderId,
        toCompleteOrderGiglReceiver(addressRef.current),
        controller.signal
      );
      if (!controller.signal.aborted) {
        applyQuoteResult(result);
        return result;
      }
    } catch (requestError: unknown) {
      if (controller.signal.aborted) return;
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

  const updateAddressField = (field: OrderGiglMissingField, value: string) => {
    setAddressDraft((previous) => {
      const next = { ...previous, [field]: value };
      addressRef.current = next;
      return next;
    });
    invalidateQuote();
  };

  const refreshBalance = async () => {
    const summary = await getMerchantWalletSummary();
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
      stopPolling();
      setWallet({ ...next, canBook: false });
      walletRef.current = { ...next, canBook: false };
      const refreshed = await requestQuote();
      if (refreshed?.canBook) invalidateFundingQueries();
      return refreshed
        ? {
            availableBalance: refreshed.availableBalance,
            canBook: refreshed.canBook,
            shortfall: refreshed.shortfall,
          }
        : walletRef.current;
    }
    return next;
  };

  const startFunding = async () => {
    if (!enabledRef.current || fundingRef.current) return;
    fundingRef.current = true;
    setState('funding');
    setError(null);
    try {
      const existing = await getMerchantWalletFundingAccount();
      const response = existing
        ? { account: existing, status: existing.status }
        : await requestMerchantWalletFundingAccount();
      setFundingAccount(response.account);
      setState(
        response.account?.status === 'active' ? 'ready' : 'funding_pending'
      );
    } catch (fundingError: unknown) {
      setError(
        fundingError instanceof Error
          ? fundingError.message
          : 'Unable to prepare wallet funding.'
      );
      setState('error');
    } finally {
      fundingRef.current = false;
    }
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
    if (!enabledRef.current || !quoteRef.current) return;
    setState('polling');
    pollRef.current = setInterval(() => {
      pollCountRef.current += 1;
      void refreshBalance().catch((pollError: unknown) => {
        stopPolling();
        setError(
          pollError instanceof Error
            ? pollError.message
            : 'Unable to refresh wallet balance.'
        );
        setState('error');
      });
      if (pollCountRef.current >= GIGL_MAX_POLL_COUNT) {
        stopPolling();
        setState('ready');
      }
    }, GIGL_POLL_INTERVAL_MS);
  };

  const reset = () => {
    controllerRef.current?.abort();
    stopPolling();
    setError(null);
    setMissingFields([]);
    setState('idle');
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: scalar dependencies prevent a render loop while keeping the draft current
  useEffect(() => {
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
    if (enabled) void requestQuote();
    else reset();
    return () => {
      controllerRef.current?.abort();
      stopPolling();
    };
  }, [enabled, orderId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stopPolling only mutates stable refs
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        stopPolling();
        setState((previous) => (previous === 'polling' ? 'ready' : previous));
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
    requestQuote,
    reset,
    startFunding,
    startTransferPoll,
    state,
    updateAddressField,
    wallet,
  };
}
