'use client';

import { Render } from '@measured/puck';
import { builderConfig } from '@/components/builder/config';
import { Data } from '@measured/puck';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMerchant } from '@/hooks/use-merchant';
import { createClient } from '@/lib/supabase/client';

interface PuckStorefrontProps {
    onNoConfig?: () => void;
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
                    const configWithTheme = pageConfig.published_config as { theme?: Record<string, unknown> };
                    if (configWithTheme.theme) {
                        const { applyTheme } = await import('@/lib/theme-manager');
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        applyTheme(configWithTheme.theme as any);
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
                <Loader2 className="h-8 w-8 motion-safe:animate-spin" aria-label="Loading store" />
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
