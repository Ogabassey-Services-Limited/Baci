import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { fetchAnalyticsConfigContext } from '@/lib/analytics-config-context';
import {
  type AnalyticsState,
  analyticsStatesEqual,
  buildAnalyticsDiff,
} from '@/lib/analytics-config-diff';
import { invalidateAnalyticsSaveReadiness } from '@/lib/analytics-save-readiness';
import { supabase } from '@/lib/supabase';
import { useMerchantScopedPending } from './useMerchantScopedPending';

const INITIAL_STATE: AnalyticsState = {
  google_analytics_id: '',
  ga4_api_secret: '',
  facebook_pixel_id: '',
  facebook_capi_token: '',
  tiktok_pixel_id: '',
  tiktok_access_token: '',
  snapchat_pixel_id: '',
  snapchat_capi_token: '',
  offline_conversions_enabled: true,
};

function toAnalyticsState(merchant: Partial<AnalyticsState>): AnalyticsState {
  return {
    google_analytics_id: merchant.google_analytics_id || '',
    ga4_api_secret: merchant.ga4_api_secret || '',
    facebook_pixel_id: merchant.facebook_pixel_id || '',
    facebook_capi_token: merchant.facebook_capi_token || '',
    tiktok_pixel_id: merchant.tiktok_pixel_id || '',
    tiktok_access_token: merchant.tiktok_access_token || '',
    snapchat_pixel_id: merchant.snapchat_pixel_id || '',
    snapchat_capi_token: merchant.snapchat_capi_token || '',
    offline_conversions_enabled: merchant.offline_conversions_enabled !== false,
  };
}

function analyticsSaveScope(
  merchantId: string | undefined,
  userId: string | undefined
) {
  return merchantId && userId ? `${userId}:${merchantId}` : null;
}

interface UseAnalyticsConfigFormParams {
  hasGrowthIntegrations: boolean;
  isSetupOrigin: boolean;
  merchantId: string | undefined;
  onBack: () => void;
  userId: string | undefined;
}

export function useAnalyticsConfigForm({
  hasGrowthIntegrations,
  isSetupOrigin,
  merchantId,
  onBack,
  userId,
}: UseAnalyticsConfigFormParams) {
  const queryClient = useQueryClient();
  const savePending = useMerchantScopedPending();
  const activeMerchantIdRef = useRef(merchantId);
  const activeUserIdRef = useRef(userId);
  useLayoutEffect(() => {
    activeMerchantIdRef.current = merchantId;
    activeUserIdRef.current = userId;
  }, [merchantId, userId]);

  const [analytics, setAnalytics] = useState<AnalyticsState>(INITIAL_STATE);
  const analyticsRef = useRef<AnalyticsState>(INITIAL_STATE);
  useLayoutEffect(() => {
    analyticsRef.current = analytics;
  }, [analytics]);
  const [isDirty, setIsDirty] = useState(false);
  const [seededSnapshot, setSeededSnapshot] = useState<AnalyticsState | null>(
    null
  );
  const scope = `${userId ?? ''}:${merchantId ?? ''}`;
  const saveScope = analyticsSaveScope(merchantId, userId);
  const [formScope, setFormScope] = useState(scope);

  // State is scoped to the active merchant and user. Reset during render so
  // React restarts before committing a frame that could show merchant A's
  // unsaved credentials under merchant B. The mutation's captured context and
  // active refs below still suppress stale completion callbacks.
  if (formScope !== scope) {
    setFormScope(scope);
    setAnalytics(INITIAL_STATE);
    setIsDirty(false);
    setSeededSnapshot(null);
  }

  const hasSeeded = seededSnapshot !== null;
  const shouldBackgroundRefetch = !(hasSeeded && isDirty);
  const {
    data: trackingConfig,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['merchant-analytics-full', userId, merchantId],
    queryFn: () => {
      if (!merchantId) throw new Error('No merchant found');
      return fetchAnalyticsConfigContext(merchantId);
    },
    enabled: Boolean(userId && merchantId && hasGrowthIntegrations),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: shouldBackgroundRefetch,
    refetchOnReconnect: shouldBackgroundRefetch,
  });

  const canManageAnalytics = trackingConfig?.isOwner === true;
  if (trackingConfig && !isDirty) {
    const seeded = toAnalyticsState(trackingConfig.analytics);
    if (!analyticsStatesEqual(seededSnapshot, seeded)) {
      setSeededSnapshot(seeded);
      setAnalytics(seeded);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (submittedAnalytics?: AnalyticsState) => {
      if (!merchantId) throw new Error('No merchant found');
      if (!seededSnapshot) {
        throw new Error(
          'Analytics settings are still loading. Please try again.'
        );
      }
      if (!canManageAnalytics) {
        throw new Error(
          'Only the store owner can manage analytics credentials.'
        );
      }

      const savedAnalytics = submittedAnalytics ?? analyticsRef.current;
      const update = buildAnalyticsDiff(savedAnalytics, seededSnapshot);
      if (Object.keys(update).length === 0) return savedAnalytics;

      const { error } = await supabase
        .from('merchants')
        .update(update)
        .eq('id', merchantId);
      if (error) throw error;
      return savedAnalytics;
    },
    onMutate: () => {
      const context = { merchantId, userId };
      savePending.begin(analyticsSaveScope(context.merchantId, context.userId));
      return context;
    },
    onSuccess: async (savedAnalytics, _variables, context) => {
      const readinessMerchantId = context?.merchantId ?? merchantId;
      const savedUserId = context?.userId ?? userId;
      const completedAnalytics = savedAnalytics ?? analyticsRef.current;
      if (!readinessMerchantId || !savedUserId) {
        throw new Error('No merchant found');
      }
      await invalidateAnalyticsSaveReadiness(
        queryClient,
        readinessMerchantId,
        savedUserId
      );
      if (
        activeMerchantIdRef.current !== readinessMerchantId ||
        activeUserIdRef.current !== savedUserId
      ) {
        return;
      }

      const hasPendingEdits = !analyticsStatesEqual(
        analyticsRef.current,
        completedAnalytics
      );
      setSeededSnapshot(completedAnalytics);
      setIsDirty(hasPendingEdits);
      queryClient.setQueryData(
        ['merchant-analytics-full', savedUserId, readinessMerchantId],
        { analytics: completedAnalytics, isOwner: true }
      );
      if (isSetupOrigin) {
        onBack();
        return;
      }
      Alert.alert('Success', 'Analytics settings saved!', [
        { text: 'OK', onPress: onBack },
      ]);
    },
    onError: (error: Error, _variables, context) => {
      const errorMerchantId = context?.merchantId ?? merchantId;
      const errorUserId = context?.userId ?? userId;
      if (
        errorMerchantId &&
        errorUserId &&
        (activeMerchantIdRef.current !== errorMerchantId ||
          activeUserIdRef.current !== errorUserId)
      ) {
        return;
      }
      Alert.alert('Error', error.message);
    },
    onSettled: (_data, _error, _variables, context) => {
      savePending.end(analyticsSaveScope(context?.merchantId, context?.userId));
    },
  });

  const updateField = (
    field: keyof AnalyticsState,
    value: string | boolean
  ) => {
    setIsDirty(true);
    setAnalytics((previous) => ({ ...previous, [field]: value }));
  };

  return {
    analytics,
    canManageAnalytics,
    handleSave: () => saveMutation.mutate({ ...analytics }),
    isError,
    isLoading,
    isSavePending: savePending.isPending(saveScope),
    refetch,
    trackingConfig,
    updateField,
  };
}
