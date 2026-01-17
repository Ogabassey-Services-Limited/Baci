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
import { JumiaBrandSelector } from './brand-selector';
import { JumiaCategorySelector } from './category-selector';

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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function ExportToJumiaDialog({
  product,
  merchantId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: ExportToJumiaDialogProps) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState<string>('');
  const [_categoryName, setCategoryName] = useState<string>('');
  const [brand, setBrand] = useState<string>('Generic');

  const handleExport = async () => {
    if (!categoryId || !brand) {
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
        merchantId,
        productData: {
          SellerSku: product.sku,
          Name: product.name,
          Brand: brand,
          Description: product.description || product.name,
          TaxClass: 'Default', // Default for now
          Price: Number(product.price),
          Status: 'Active',
          PrimaryCategory: categoryId,
          MainImage: product.images?.[0] || '',
          Images: product.images || [],
          ProductData: {
            // Optional attributes could go here
          },
        },
      };

      const res = await fetch('/api/marketplace/jumia/products/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Export failed');
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
              value={categoryId}
              onSelect={(id, name) => {
                setCategoryId(id);
                setCategoryName(name);
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
