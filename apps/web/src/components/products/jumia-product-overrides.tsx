'use client';

import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { JumiaPriceForm } from '@/components/products/jumia-price-form';
import { JumiaSyncSettings } from '@/components/products/jumia-sync-settings';
import { ThemedBadge } from '@/components/themed/themed-badge';
import { ThemedButton } from '@/components/themed/themed-button';
import { ThemedCard } from '@/components/themed/themed-card';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getClientCsrfToken } from '@/lib/csrf';
import type { JumiaMapping } from '@/lib/jumia/types';

interface JumiaProductOverridesProps {
  productId: string;
  basePrice: number;
  integrationId: string;
}

export function JumiaProductOverrides({
  productId,
  basePrice,
  integrationId,
}: JumiaProductOverridesProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapping, setMapping] = useState<JumiaMapping | null>(null);

  const [overrides, setOverrides] = useState({
    price: '',
    salePrice: '',
    saleStart: '',
    saleEnd: '',
    isActive: true,
    syncInventory: true,
    syncPrice: false,
  });

  useEffect(() => {
    async function fetchMapping() {
      try {
        const response = await fetch(
          `/api/marketplace/jumia/products?productId=${productId}&integrationId=${integrationId}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.mapping) {
            setMapping(data.mapping);
            setOverrides({
              price: data.mapping.jumia_price?.toString() || '',
              salePrice: data.mapping.jumia_sale_price?.toString() || '',
              saleStart: data.mapping.jumia_sale_start
                ? data.mapping.jumia_sale_start.split('T')[0]
                : '',
              saleEnd: data.mapping.jumia_sale_end
                ? data.mapping.jumia_sale_end.split('T')[0]
                : '',
              isActive: data.mapping.is_active ?? true,
              syncInventory: data.mapping.sync_inventory ?? true,
              syncPrice: data.mapping.sync_price ?? false,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch Jumia mapping:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMapping();
  }, [productId, integrationId]);

  const handleSave = async () => {
    if (!mapping) return;

    setSaving(true);
    try {
      const csrfToken = getClientCsrfToken();
      const response = await fetch('/api/marketplace/jumia/products/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'x-csrf-token': csrfToken }),
        },
        body: JSON.stringify({
          productId,
          integrationId,
          overrides: {
            jumia_price: overrides.price
              ? Number.parseFloat(overrides.price)
              : null,
            jumia_sale_price: overrides.salePrice
              ? Number.parseFloat(overrides.salePrice)
              : null,
            jumia_sale_start: overrides.saleStart || null,
            jumia_sale_end: overrides.saleEnd || null,
            is_active: overrides.isActive,
            sync_inventory: overrides.syncInventory,
            sync_price: overrides.syncPrice,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update overrides');
      }

      toast({
        title: 'Jumia Overrides Saved',
        description: 'Product settings have been updated and pushed to Jumia.',
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedCard className="animate-pulse">
        <CardContent
          className="flex items-center justify-center p-12"
          role="status"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </ThemedCard>
    );
  }

  if (!mapping) {
    return null; // Don't show if not mapped to Jumia
  }

  return (
    <ThemedCard accentPosition="top" accentColor="primary">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="relative h-6 w-6 overflow-hidden rounded">
              <Image
                src="/jumia-logo.png"
                alt="Jumia"
                fill
                sizes="24px"
                className="object-cover"
              />
            </div>
            <CardTitle className="text-xl">Jumia Marketplace</CardTitle>
          </div>
          <CardDescription>
            Manage Jumia-specific pricing and status for this product
          </CardDescription>
        </div>
        <div className="flex items-center gap-4">
          <ThemedBadge variant="outline" colorRole="accent">
            SKU: {mapping.jumia_sku}
          </ThemedBadge>
          <Switch
            checked={overrides.isActive}
            onCheckedChange={(checked) =>
              setOverrides((prev) => ({ ...prev, isActive: checked }))
            }
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <JumiaPriceForm
          overrides={overrides}
          setOverrides={setOverrides}
          basePrice={basePrice}
        />

        <JumiaSyncSettings overrides={overrides} setOverrides={setOverrides} />

        <div className="flex justify-end pt-4 border-t">
          <ThemedButton
            onClick={handleSave}
            disabled={saving}
            className="w-full md:w-auto min-w-[180px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating Jumia...
              </>
            ) : (
              'Save Jumia Settings'
            )}
          </ThemedButton>
        </div>
      </CardContent>
    </ThemedCard>
  );
}
