'use client';

import { useEffect, useState } from 'react';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';

interface UseIntegrationSettingsOptions<T> {
  /** Keys to fetch from the merchant features API */
  keys: (keyof T)[];
  /** Platform name for toast messages */
  platformName: string;
}

interface UseIntegrationSettingsReturn<T> {
  /** Current settings values */
  settings: T | null;
  /** Whether the settings are loading */
  isLoading: boolean;
  /** Whether the merchant is available */
  hasMerchant: boolean;
  /** Save settings to the API */
  saveSettings: (updates: Partial<T>) => Promise<void>;
}

/**
 * Shared hook for integration pages to fetch and save settings
 * from the merchant features API.
 *
 * @example
 * ```tsx
 * interface FacebookSettings {
 *   facebook_pixel_id: string | null;
 *   facebook_capi_token: string | null;
 * }
 *
 * const { settings, isLoading, saveSettings } = useIntegrationSettings<FacebookSettings>({
 *   keys: ['facebook_pixel_id', 'facebook_capi_token'],
 *   platformName: 'Facebook',
 * });
 * ```
 */
export function useIntegrationSettings<T extends object>({
  keys,
  platformName,
}: UseIntegrationSettingsOptions<T>): UseIntegrationSettingsReturn<T> {
  const { merchant } = useMerchant();
  const { toast } = useToast();
  const [settings, setSettings] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current settings from the features API
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/merchant/features');
        if (response.ok) {
          const data = await response.json();
          // Extract only the keys we care about
          const extracted = {} as T;
          for (const key of keys) {
            extracted[key] = data[key as string] ?? null;
          }
          setSettings(extracted);
        }
      } catch (error) {
        console.error('Failed to fetch settings for', platformName, ':', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (merchant) {
      fetchSettings();
    }
  }, [merchant, keys, platformName]);

  // Save settings to the features API
  const saveSettings = async (updates: Partial<T>) => {
    try {
      const response = await fetch('/api/merchant/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const data = await response.json();
      // Extract only the keys we care about from the response
      const extracted = {} as T;
      for (const key of keys) {
        extracted[key] = data[key as string] ?? null;
      }
      setSettings(extracted);

      toast({
        title: 'Settings saved',
        description: `Your ${platformName} settings have been updated.`,
      });
    } catch (error) {
      console.error('Failed to save settings for', platformName, ':', error);
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'Could not save your settings. Please try again.',
      });
      throw error;
    }
  };

  return {
    settings,
    isLoading,
    hasMerchant: !!merchant,
    saveSettings,
  };
}
