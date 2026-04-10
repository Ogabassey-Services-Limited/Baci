'use client';

import { useState } from 'react';
import { ThemedButton } from '@/components/themed/themed-button';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import { sanitizeText, stripHtmlTags } from '@/lib/sanitize-core';
import { JumiaBrandSelector } from './brand-selector';
import { JumiaCategorySelector } from './category-selector';

type ExportResponse =
  | { success: true; feedId: string }
  | { success: false; error: string; feedErrors?: string[] };

interface ExportToJumiaDialogProps {
  product: {
    id: string;
    sku: string;
    name: string;
    description: string;
    price: number;
    images?: string[];
  };
  merchantId: string;
  integrationId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function ExportToJumiaDialog({
  product,
  merchantId,
  integrationId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: ExportToJumiaDialogProps) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Reset selections when dialog closes
      setCategoryCode(null);
      setBrand(null);
    }
    (controlledOnOpenChange ?? setInternalOpen)(nextOpen);
  };

  const [loading, setLoading] = useState(false);
  const [categoryCode, setCategoryCode] = useState<number | null>(null);
  const [brand, setBrand] = useState<{ code: number; name: string } | null>(
    null
  );

  const handleExport = async () => {
    if (!categoryCode || !brand) {
      toast({
        title: 'Selection Required',
        description: 'Please select a Category and Brand',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        integrationId,
        merchantId,
        name: sanitizeText(stripHtmlTags(product.name)),
        brand: {
          code: brand.code,
          name: sanitizeText(stripHtmlTags(brand.name)),
        },
        category: { code: categoryCode },
        description: sanitizeText(
          stripHtmlTags(product.description || product.name)
        ),
        images: (product.images ?? [])
          .filter((url) => {
            if (!url) return false;
            try {
              const parsed = new URL(url);
              return (
                parsed.protocol === 'http:' || parsed.protocol === 'https:'
              );
            } catch {
              return false;
            }
          })
          .map((url, i) => ({
            url,
            primary: i === 0,
          })),
        variations: [
          {
            sellerSku: product.sku,
            price: product.price,
            // NGN is Nigeria-pilot specific; derive from merchant config when multi-country support is added
            currency: 'NGN',
          },
        ],
      };

      const res = await fetchWithCsrf(
        '/api/marketplace/jumia/products/export',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        let message = res.statusText || 'Export failed';
        try {
          const errorBody = await res.json();
          if (errorBody.error) message = errorBody.error;
        } catch {
          // Response body is not JSON, use statusText
        }
        throw new Error(message);
      }

      let data: ExportResponse;
      try {
        data = await res.json();
      } catch {
        throw new Error('Invalid response from server');
      }

      if (!data.success) {
        const MAX_DISPLAYED_ERRORS = 3;
        const MAX_ERROR_LENGTH = 200;
        const MAX_TOTAL_LENGTH = 500;
        let feedDetail = '';
        if (data.feedErrors && data.feedErrors.length > 0) {
          const displayed = data.feedErrors
            .slice(0, MAX_DISPLAYED_ERRORS)
            .map((e) => {
              const safe = sanitizeText(e);
              return safe.length > MAX_ERROR_LENGTH
                ? `${safe.slice(0, MAX_ERROR_LENGTH)}...`
                : safe;
            });
          feedDetail = `\n${displayed.join('\n')}`;
          if (data.feedErrors.length > MAX_DISPLAYED_ERRORS) {
            feedDetail += `\n... (${data.feedErrors.length - MAX_DISPLAYED_ERRORS} more errors)`;
          }
        }
        let message = sanitizeText(data.error || 'Export failed') + feedDetail;
        if (message.length > MAX_TOTAL_LENGTH) {
          message = `${message.slice(0, MAX_TOTAL_LENGTH)}... (truncated)`;
        }
        throw new Error(message);
      }

      toast({
        title: 'Export Started',
        description: `Feed ID: ${data.feedId}`,
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Export failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Export to Jumia
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export "{product.name}" to Jumia</DialogTitle>
          <DialogDescription>
            Map this product to a Jumia Category and Brand to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Category */}
          <div className="grid gap-2">
            <Label>Jumia Category (Required)</Label>
            <JumiaCategorySelector
              merchantId={merchantId}
              value={categoryCode ?? undefined}
              onSelect={(code) => {
                setCategoryCode(code);
              }}
            />
          </div>

          {/* Brand */}
          <div className="grid gap-2">
            <Label>Jumia Brand (Required)</Label>
            <JumiaBrandSelector
              merchantId={merchantId}
              value={brand}
              onSelect={setBrand}
            />
            <p className="text-xs text-muted-foreground">
              Must match a valid brand on Jumia or "Generic".
            </p>
          </div>

          {/* Price Preview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Price</Label>
              <div className="p-2 border rounded-md bg-muted text-sm font-medium">
                {product.price}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>SKU</Label>
              <div className="p-2 border rounded-md bg-muted text-sm font-medium">
                {product.sku}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <ThemedButton onClick={handleExport} disabled={loading}>
            {loading ? 'Exporting...' : 'Export Product'}
          </ThemedButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
