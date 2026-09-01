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

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_COUNT = 20;

export type OrderGiglShippingState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'missing_address'
  | 'funding'
  | 'funding_pending'
  | 'polling'
  | 'error';

interface InitialAddress {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
}

interface WalletState {
  availableBalance: number;
  canBook: boolean;
  shortfall: number;
}

interface Params {
  enabled: boolean;
  initialAddress?: InitialAddress;
  orderId: string;
}

function initialDraft(address?: InitialAddress): Partial<OrderGiglReceiver> {
  return {
    ...(address?.address ? { address: address.address } : {}),
    ...(address?.city ? { city: address.city } : {}),
    ...(address?.state ? { state: address.state } : {}),
    ...(address?.phone ? { phone: address.phone } : {}),
  };
}

function completeReceiver(
  draft: Partial<OrderGiglReceiver>
): OrderGiglReceiver | undefined {
  if (!draft.address || !draft.city || !draft.state || !draft.phone) {
    return undefined;
  }
  return {
    address: draft.address,
    city: draft.city,
    state: draft.state,
    phone: draft.phone,
  };
}

export function useOrderGiglShipping({
  enabled,
  initialAddress,
  orderId,
}: Params) {
  const queryClient = useQueryClient();
  const [quote, setQuote] = useState<OrderGiglQuote | null>(null);
  const quoteRef = useRef<OrderGiglQuote | null>(null);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [fundingAccount, setFundingAccount] =
    useState<MerchantWalletFundingAccount | null>(null);
  const [addressDraft, setAddressDraft] = useState<Partial<OrderGiglReceiver>>(
    initialDraft(initialAddress)
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

  const applyQuoteResult = (
    result: Awaited<ReturnType<typeof getOrderGiglQuote>>
  ) => {
    setQuote(result.quote);
    setWallet({
      availableBalance: result.availableBalance,
      canBook: result.canBook,
      shortfall: result.shortfall,
    });
    setMissingFields([]);
    setError(null);
    setState('ready');
  };

  const requestQuote = async () => {
    if (!enabledRef.current || !orderId) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState('loading');
    setError(null);
    try {
      const result = await getOrderGiglQuote(
        orderId,
        completeReceiver(addressRef.current),
        controller.signal
      );
      if (!controller.signal.aborted) applyQuoteResult(result);
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
  };

  const updateAddressField = (field: OrderGiglMissingField, value: string) => {
    setAddressDraft((previous) => {
      const next = { ...previous, [field]: value };
      addressRef.current = next;
      return next;
    });
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
    if (next.canBook) {
      stopPolling();
      setState('ready');
      invalidateFundingQueries();
    }
    return next;
  };

  const startFunding = async () => {
    if (!enabledRef.current) return;
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
      if (pollCountRef.current >= MAX_POLL_COUNT) {
        stopPolling();
        setState('ready');
      }
    }, POLL_INTERVAL_MS);
  };

  const reset = () => {
    controllerRef.current?.abort();
    stopPolling();
    setError(null);
    setMissingFields([]);
    setState('idle');
  };

  // Track scalar address fields because the controller recreates the wrapper object.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scalar dependencies prevent a render loop while keeping the draft current
  useEffect(() => {
    const next = initialDraft(initialAddress);
    setAddressDraft(next);
    addressRef.current = next;
  }, [
    initialAddress?.address,
    initialAddress?.city,
    initialAddress?.phone,
    initialAddress?.state,
  ]);

  // Quote requests intentionally run only when this order's method step opens.
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
