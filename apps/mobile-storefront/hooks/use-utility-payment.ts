import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { listSavedVtuCards, type VTUPaymentGateway } from '@/lib/vtu-checkout';
import {
  getEnabledPaymentMethods,
  useMerchantPaymentSettings,
} from './useMerchantPaymentSettings';
import { useAuthStore } from '@/stores/auth-store';

export type UtilityPaymentGateway = VTUPaymentGateway;

const SUPPORTED_UTILITY_GATEWAYS: UtilityPaymentGateway[] = [
  'paystack',
  'korapay',
];

export function useUtilityPayment() {
  const isAuthenticated = useAuthStore((state) => !!state.session);
  const [selectedGateway, setSelectedGateway] =
    useState<UtilityPaymentGateway>('paystack');
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(
    null
  );
  const paymentSettings = useMerchantPaymentSettings();
  const savedCardsQuery = useQuery({
    enabled: isAuthenticated,
    queryKey: ['vtu-saved-cards'],
    queryFn: listSavedVtuCards,
    staleTime: 5 * 60 * 1000,
  });

  const supportedGateways: UtilityPaymentGateway[] = (() => {
    const enabled = getEnabledPaymentMethods(paymentSettings.data);
    const filtered = enabled.filter((method): method is UtilityPaymentGateway =>
      SUPPORTED_UTILITY_GATEWAYS.some((gateway) => gateway === method)
    );

    return filtered.length > 0 ? filtered : ['paystack'];
  })();

  useEffect(() => {
    if (!supportedGateways.includes(selectedGateway)) {
      setSelectedGateway(supportedGateways[0] ?? 'paystack');
    }
  }, [selectedGateway, supportedGateways]);

  useEffect(() => {
    const defaultCard = savedCardsQuery.data?.find((card) => card.is_default);
    if (
      !selectedSavedCardId &&
      selectedGateway === 'paystack' &&
      defaultCard?.id
    ) {
      setSelectedSavedCardId(defaultCard.id);
    }
  }, [savedCardsQuery.data, selectedGateway, selectedSavedCardId]);

  return {
    cards: savedCardsQuery.data ?? [],
    isLoadingCards: savedCardsQuery.isLoading,
    refetchCards: savedCardsQuery.refetch,
    selectedGateway,
    selectedSavedCardId,
    selectGateway: (gateway: UtilityPaymentGateway) => {
      setSelectedSavedCardId(null);
      setSelectedGateway(gateway);
    },
    selectSavedCard: (cardId: string) => {
      setSelectedSavedCardId(cardId);
      setSelectedGateway('paystack');
    },
    supportedGateways,
  };
}
