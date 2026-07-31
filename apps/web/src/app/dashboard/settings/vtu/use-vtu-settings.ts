'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fetchWithCsrf } from '@/lib/api-client';
import { DEFAULT_VTU_SETTINGS, type VTUSettings } from './vtu-settings-types';

type Toast = (message: {
  title: string;
  description: string;
  variant?: 'destructive';
}) => void;

async function fetchVtuSettings(
  merchantId: string
): Promise<VTUSettings | null> {
  try {
    const response = await fetch(
      `/api/merchant/features?${new URLSearchParams({ merchantId })}`
    );
    if (!response.ok) return null;

    const data = await response.json();
    return {
      vtu_enabled: data.vtu_enabled ?? false,
      vtu_airtime_enabled: data.vtu_airtime_enabled ?? true,
      vtu_data_enabled: data.vtu_data_enabled ?? true,
      vtu_checkout_addon_enabled: data.vtu_checkout_addon_enabled ?? false,
      vtu_checkout_addon_amounts:
        data.vtu_checkout_addon_amounts ||
        DEFAULT_VTU_SETTINGS.vtu_checkout_addon_amounts,
      vtu_loyalty_reward_enabled: data.vtu_loyalty_reward_enabled ?? false,
      vtu_merchant_commission_rate: data.vtu_merchant_commission_rate ?? 0.5,
    };
  } catch (error) {
    console.error('Failed to fetch VTU settings:', error);
    return null;
  }
}

export function useVtuSettings(merchantId: string | undefined, toast: Toast) {
  const [settings, setSettings] = useState<VTUSettings>(DEFAULT_VTU_SETTINGS);
  const [loading, setLoading] = useState(Boolean(merchantId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const activeMerchantIdRef = useRef(merchantId);
  const activeLoadRef = useRef({ merchantId, reloadToken });

  useLayoutEffect(() => {
    activeMerchantIdRef.current = merchantId;
    activeLoadRef.current = { merchantId, reloadToken };
  }, [merchantId, reloadToken]);

  useLayoutEffect(() => {
    setSettings(DEFAULT_VTU_SETTINGS);
    setLoading(Boolean(merchantId));
    setLoadError(null);
    setSaving(false);
    setReloadToken(0);
    setNewAmount('');
  }, [merchantId]);

  useEffect(() => {
    if (!merchantId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void fetchVtuSettings(merchantId).then((fetchedSettings) => {
      if (
        cancelled ||
        activeLoadRef.current.merchantId !== merchantId ||
        activeLoadRef.current.reloadToken !== reloadToken
      ) {
        return;
      }

      if (fetchedSettings) {
        setSettings(fetchedSettings);
        setLoadError(null);
      } else {
        setLoadError('Failed to load VTU settings.');
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [merchantId, reloadToken]);

  const retryLoad = () => {
    if (!merchantId) return;
    setLoading(true);
    setLoadError(null);
    setReloadToken((token) => token + 1);
  };

  const save = () => {
    if (!merchantId) return;

    const submittedMerchantId = merchantId;
    const submittedSettings = settings;
    setSaving(true);

    void fetchWithCsrf('/api/merchant/features', {
      method: 'PATCH',
      body: JSON.stringify({
        ...submittedSettings,
        merchantId: submittedMerchantId,
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to save settings');
        if (activeMerchantIdRef.current !== submittedMerchantId) return;
        toast({
          title: 'Settings Saved',
          description: 'VTU settings have been updated.',
        });
      })
      .catch(() => {
        if (activeMerchantIdRef.current !== submittedMerchantId) return;
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to save VTU settings.',
        });
      })
      .finally(() => {
        if (activeMerchantIdRef.current === submittedMerchantId) {
          setSaving(false);
        }
      });
  };

  const addAmount = () => {
    const amount = Number.parseInt(newAmount, 10);
    if (
      amount >= 50 &&
      amount <= 10000 &&
      !settings.vtu_checkout_addon_amounts.includes(amount)
    ) {
      setSettings({
        ...settings,
        vtu_checkout_addon_amounts: [
          ...settings.vtu_checkout_addon_amounts,
          amount,
        ].sort((a, b) => a - b),
      });
      setNewAmount('');
    }
  };

  const removeAmount = (amount: number) => {
    setSettings({
      ...settings,
      vtu_checkout_addon_amounts: settings.vtu_checkout_addon_amounts.filter(
        (current) => current !== amount
      ),
    });
  };

  return {
    addAmount,
    loadError,
    loading,
    newAmount,
    removeAmount,
    retryLoad,
    save,
    saving,
    setNewAmount,
    setSettings,
    settings,
  };
}
