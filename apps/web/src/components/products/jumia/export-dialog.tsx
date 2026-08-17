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

interface JumiaExportProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  images?: string[];
}

interface BuildExportPayloadParams {
  product: JumiaExportProduct;
  merchantId: string;
  integrationId: string;
  categoryCode: number;
  brand: { code: number; name: string };
}

type ExportResult =
  | { ok: true; feedId: string }
  | { ok: false; message: string };

const MAX_DISPLAYED_FEED_ERRORS = 3;
const MAX_FEED_ERROR_LENGTH = 200;
const MAX_TOTAL_FEED_ERROR_LENGTH = 500;

function buildExportPayload({
  product,
  merchantId,
  integrationId,
  categoryCode,
  brand,
}: BuildExportPayloadParams) {
  return {
    integrationId,
    merchantId,
    productId: product.id,
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
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
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
}

function buildFeedErrorDetail(feedErrors: string[] | undefined): string {
  if (!feedErrors || feedErrors.length === 0) {
    return '';
  }

  const displayed = feedErrors.slice(0, MAX_DISPLAYED_FEED_ERRORS).map((e) => {
    const safe = sanitizeText(e);
    return safe.length > MAX_FEED_ERROR_LENGTH
      ? `${safe.slice(0, MAX_FEED_ERROR_LENGTH)}...`
      : safe;
  });

  let detail = `\n${displayed.join('\n')}`;
  if (feedErrors.length > MAX_DISPLAYED_FEED_ERRORS) {
    detail += `\n... (${feedErrors.length - MAX_DISPLAYED_FEED_ERRORS} more errors)`;
  }
  return detail;
}

/**
 * Module-scope helper that owns the network request and its try/catch/throw
 * control flow. Keeping this out of the component body lets React Compiler
 * memoize the dialog (the compiler cannot lower try/finally or throw-in-try).
 */
async function submitJumiaExport(
  payload: ReturnType<typeof buildExportPayload>
): Promise<ExportResult> {
  const res = await fetchWithCsrf('/api/marketplace/jumia/products/export', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = res.statusText || 'Export failed';
    try {
      const errorBody = await res.json();
      if (errorBody.error) message = errorBody.error;
    } catch {
      // Response body is not JSON, use statusText
    }
    return { ok: false, message };
  }

  let data: ExportResponse;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: 'Invalid response from server' };
  }

  if (!data.success) {
    const feedDetail = buildFeedErrorDetail(data.feedErrors);
    let message = sanitizeText(data.error || 'Export failed') + feedDetail;
    if (message.length > MAX_TOTAL_FEED_ERROR_LENGTH) {
      message = `${message.slice(0, MAX_TOTAL_FEED_ERROR_LENGTH)}... (truncated)`;
    }
    return { ok: false, message };
  }

  return { ok: true, feedId: data.feedId };
}

interface ExportToJumiaDialogProps {
  product: JumiaExportProduct;
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

  const handleExport = () => {
    if (!categoryCode || !brand) {
      toast({
        title: 'Selection Required',
        description: 'Please select a Category and Brand',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const payload = buildExportPayload({
      product,
      merchantId,
      integrationId,
      categoryCode,
      brand,
    });

    submitJumiaExport(payload)
      .then((result) => {
        if (result.ok) {
          toast({
            title: 'Export Started',
            description: `Feed ID: ${result.feedId}`,
          });
          setOpen(false);
          return;
        }

        toast({
          title: 'Export Failed',
          description: result.message,
          variant: 'destructive',
        });
      })
      .catch((error) => {
        toast({
          title: 'Export Failed',
          description: error instanceof Error ? error.message : 'Export failed',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setLoading(false);
      });
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
              integrationId={integrationId}
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
              integrationId={integrationId}
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
