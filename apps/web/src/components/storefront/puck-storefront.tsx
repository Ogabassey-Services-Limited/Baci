'use client';

import { type Data, Render } from '@puckeditor/core';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { builderConfig } from '@/components/builder/config';
import { useMerchant } from '@/hooks/use-merchant-client';
import { createClient } from '@/lib/supabase/client';
import { defaultTheme, type ThemeConfiguration } from '@/lib/theme-config';

interface PuckStorefrontProps {
  onNoConfig?: () => void;
}

function isThemeObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const IS_DEV = process.env.NODE_ENV !== 'production';

function normalizeThemeConfiguration(
  defaults: ThemeConfiguration,
  overrides: Partial<ThemeConfiguration>
): ThemeConfiguration {
  const mergeIntoDefaults = (
    fallback: Record<string, unknown>,
    incoming: Record<string, unknown>
  ): Record<string, unknown> => {
    const merged: Record<string, unknown> = { ...fallback };

    for (const [key, value] of Object.entries(incoming)) {
      if (!Object.hasOwn(fallback, key)) {
        continue;
      }

      const fallbackValue = fallback[key];
      if (isThemeObject(fallbackValue)) {
        if (isThemeObject(value)) {
          merged[key] = mergeIntoDefaults(fallbackValue, value);
        } else if (IS_DEV) {
          console.warn('Theme override type mismatch', {
            key,
            expectedType: 'object',
            receivedType: typeof value,
            receivedValue: value,
          });
        }
        continue;
      }

      if (typeof value === typeof fallbackValue) {
        merged[key] = value;
      } else if (IS_DEV) {
        console.warn('Theme override type mismatch', {
          key,
          expectedType: typeof fallbackValue,
          receivedType: typeof value,
          receivedValue: value,
        });
      }
    }

    return merged;
  };

  return mergeIntoDefaults(
    defaults as unknown as Record<string, unknown>,
    overrides as Record<string, unknown>
  ) as unknown as ThemeConfiguration;
}

export function PuckStorefront({ onNoConfig }: PuckStorefrontProps) {
  const { merchant } = useMerchant();
  const [puckData, setPuckData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPuckConfig() {
      if (!merchant?.id) return;

      try {
        const supabase = createClient();

        // Fetch published Puck config
        const { data: pageConfig, error: fetchError } = await supabase
          .from('page_configs')
          .select('published_config')
          .eq('merchant_id', merchant.id)
          .eq('page_slug', 'home')
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No config found - trigger fallback
            onNoConfig?.();
          } else {
            throw fetchError;
          }
        } else if (pageConfig?.published_config) {
          setPuckData(pageConfig.published_config as Data);

          // Apply theme if it exists
          const configWithTheme = pageConfig.published_config as {
            theme?: Partial<ThemeConfiguration>;
          };
          if (configWithTheme.theme) {
            const { applyTheme, validateTheme } = await import(
              '@/lib/theme-manager'
            );
            const normalizedTheme = normalizeThemeConfiguration(
              defaultTheme,
              configWithTheme.theme
            );
            if (validateTheme(normalizedTheme)) {
              applyTheme(normalizedTheme);
            }
          }
        } else {
          // Config exists but is empty
          onNoConfig?.();
        }
      } catch (err) {
        console.error('Failed to load Puck config:', err);
        onNoConfig?.();
      } finally {
        setLoading(false);
      }
    }

    loadPuckConfig();
  }, [merchant?.id, onNoConfig]);

  if (loading) {
    return (
      <div
        className="flex h-screen w-full items-center justify-center"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <Loader2
          className="h-8 w-8 motion-safe:animate-spin"
          aria-label="Loading store"
        />
      </div>
    );
  }

  // If no Puck data, return null (fallback will be shown)
  if (!puckData) {
    return null;
  }

  // Render using Puck
  return <Render config={builderConfig} data={puckData} />;
}
