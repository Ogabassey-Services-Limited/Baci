'use client';

import { AlertCircle, Loader2, Package, Printer, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface JumiaOrderItem {
  id: string;
  shopId: string;
  status: string;
  product: {
    name: string;
    sellerSku: string;
    imageUrl?: string;
  };
}

interface OrderManagerModalProps {
  orderId: string; // Jumia Order ID (UUID)
  orderNumber: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderManagerModal({
  orderId,
  orderNumber,
  isOpen,
  onClose,
}: OrderManagerModalProps) {
  const [items, setItems] = useState<JumiaOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shippingProvider, setShippingProvider] = useState('Jumia Services');
  const [deliveryType, setDeliveryType] = useState('dropshipping');
  const { toast } = useToast();

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketplace/jumia/orders/${orderId}/items`);
      if (!res.ok) throw new Error('Failed to fetch items');
      const data = await res.json();
      setItems(data.items);
    } catch (_err) {
      setError('Could not load order items.');
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization (ADR-004)
  useEffect(() => {
    if (isOpen && orderId) {
      fetchItems();
    }
  }, [isOpen, orderId]);

  const handleAction = async (
    action: 'pack' | 'ready_to_ship' | 'print_label'
  ) => {
    setActionLoading(action);
    try {
      const res = await fetch('/api/marketplace/jumia/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          orderId,
          // For now, we act on ALL items.
          // Future: checkbox selection.
          itemIds: items.map((i) => i.id),
          shippingProvider,
          deliveryType,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Action failed');

      if (action === 'print_label' && data.pdf) {
        // Open PDF
        const blob = await (
          await fetch(`data:application/pdf;base64,${data.pdf}`)
        ).blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        toast({ title: 'Label Generated', description: 'Opening PDF...' });
      } else {
        toast({ title: 'Success', description: data.message });
        fetchItems(); // Refresh status
      }
    } catch (err: unknown) {
      toast({
        title: 'Action Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 relative flex-shrink-0 border border-gray-100 rounded-md overflow-hidden bg-white">
              <Image
                src="/images/jumia-logo.png"
                alt="Jumia Logo"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <DialogTitle>Manage Jumia Order #{orderNumber}</DialogTitle>
              <DialogDescription>
                Fulfill items, print labels, and manage shipping status.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* Items List */}
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                >
                  <div className="h-12 w-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                    {item.product.imageUrl && (
                      // biome-ignore lint/performance/noImgElement: External Jumia image
                      <img
                        src={item.product.imageUrl}
                        alt=""
                        className="object-cover w-full h-full"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.product.name}</p>
                    <p className="text-sm text-gray-500">
                      SKU: {item.product.sellerSku}
                    </p>
                  </div>
                  <Badge
                    variant={
                      item.status.toLowerCase().includes('shipped')
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button
                onClick={() => handleAction('pack')}
                disabled={!!actionLoading}
                variant="secondary"
              >
                {actionLoading === 'pack' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Package className="mr-2 h-4 w-4" />
                )}
                Pack All
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'ready_to_ship' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Truck className="mr-2 h-4 w-4" />
                    )}
                    Ready to Ship...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Shipment Details</h4>
                    <div className="space-y-2">
                      <Label htmlFor="provider">Shipping Provider</Label>
                      <Input
                        id="provider"
                        value={shippingProvider}
                        onChange={(e) => setShippingProvider(e.target.value)}
                        placeholder="e.g. Jumia Services"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dtype">Delivery Type</Label>
                      <Select
                        value={deliveryType}
                        onValueChange={setDeliveryType}
                      >
                        <SelectTrigger id="dtype">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dropshipping">
                            Drop-off Station (VDO)
                          </SelectItem>
                          <SelectItem value="pickup">
                            Pickup by Jumia
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Link
                      href={`https://vendorcenter.jumia.com.ng/order/delivery-providers`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                    >
                      Check valid providers
                    </Link>
                    <Button
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleAction('ready_to_ship')}
                      disabled={!!actionLoading}
                    >
                      Confirm Ready to Ship
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                onClick={() => handleAction('print_label')}
                disabled={!!actionLoading}
                variant="outline"
              >
                {actionLoading === 'print_label' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                Print Label
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Actions apply to all items in this order.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
