'use client';

import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ThemedBadge } from '@/components/themed/themed-badge';
import { ThemedButton } from '@/components/themed/themed-button';
import { ThemedCard } from '@/components/themed/themed-card';
import { ThemedInput } from '@/components/themed/themed-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { JumiaMapping } from '@/lib/jumia/types';
import { cn } from '@/lib/utils';

interface JumiaProductOverridesProps {
  productId: string;
  basePrice: number;
}

export function JumiaProductOverrides({
  productId,
  basePrice,
}: JumiaProductOverridesProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapping, setMapping] = useState<JumiaMapping | null>(null);

  // Local state for overrides
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
          `/api/marketplace/jumia/products?productId=${productId}`
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
  }, [productId]);

  const handleSave = async () => {
    if (!mapping) return;

    setSaving(true);
    try {
      const response = await fetch('/api/marketplace/jumia/products/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
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
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </ThemedCard>
    );
  }

  if (!mapping) {
    return null; // Don't show if not mapped to Jumia
  }

  const isPriceWarning =
    overrides.isActive &&
    overrides.price &&
    Number.parseFloat(overrides.price) < basePrice * 0.8;

  return (
    <ThemedCard accentPosition="top" accentColor="primary">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="relative h-6 w-6 overflow-hidden rounded">
              <Image
                src="/images/jumia-logo.png"
                alt="Jumia"
                fill
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
        {isPriceWarning && (
          <Alert
            variant="destructive"
            className="bg-destructive/10 border-destructive/20 text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Low Price Warning</AlertTitle>
            <AlertDescription>
              Your Jumia price (₦{overrides.price}) is more than 20% lower than
              your base price (₦{basePrice}). Please verify this is intentional.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="jumia_price">Jumia Base Price</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  ₦
                </span>
                <ThemedInput
                  id="jumia_price"
                  type="number"
                  className="pl-7"
                  value={overrides.price}
                  onChange={(e) =>
                    setOverrides((prev) => ({ ...prev, price: e.target.value }))
                  }
                  placeholder={basePrice.toString()}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Leave empty to follow Baci base price
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jumia_sale_price">
                Jumia Sale Price (Optional)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  ₦
                </span>
                <ThemedInput
                  id="jumia_sale_price"
                  type="number"
                  className="pl-7"
                  value={overrides.salePrice}
                  onChange={(e) =>
                    setOverrides((prev) => ({
                      ...prev,
                      salePrice: e.target.value,
                    }))
                  }
                  placeholder="Set a dedicated sale price"
                />
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sale_start">Sale Start</Label>
                <ThemedInput
                  id="sale_start"
                  type="date"
                  value={overrides.saleStart}
                  onChange={(e) =>
                    setOverrides((prev) => ({
                      ...prev,
                      saleStart: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale_end">Sale End</Label>
                <ThemedInput
                  id="sale_end"
                  type="date"
                  value={overrides.saleEnd}
                  onChange={(e) =>
                    setOverrides((prev) => ({
                      ...prev,
                      saleEnd: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 p-4 rounded-xl border bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw
                  className={cn(
                    'h-4 w-4 text-[var(--store-primary)]',
                    overrides.syncInventory && 'animate-spin-slow'
                  )}
                />
                <span className="text-sm font-semibold">Real-time Sync</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      className="text-sm cursor-pointer"
                      htmlFor="sync-stock"
                    >
                      Sync Inventory
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Keep Jumia stock matched with Baci
                    </p>
                  </div>
                  <Switch
                    id="sync-stock"
                    checked={overrides.syncInventory}
                    onCheckedChange={(checked) =>
                      setOverrides((prev) => ({
                        ...prev,
                        syncInventory: checked,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <div className="space-y-0.5">
                    <Label
                      className="text-sm cursor-pointer"
                      htmlFor="sync-price"
                    >
                      Sync Price changes
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Auto-update Jumia when Baci price changes
                    </p>
                  </div>
                  <Switch
                    id="sync-price"
                    checked={overrides.syncPrice}
                    onCheckedChange={(checked) =>
                      setOverrides((prev) => ({ ...prev, syncPrice: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

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
