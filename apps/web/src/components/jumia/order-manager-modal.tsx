'use client';

import { AlertCircle, Loader2, Package, Printer, Truck, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import { stripHtmlTags } from '@/lib/sanitize-core';

function isValidHttpUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface JumiaOrderItem {
  id: string;
  shopId: string;
  status: string;
  product: {
    name: string;
    sellerSku: string;
    imageUrl?: string;
  };
  trackingNumber?: string;
  trackingUrl?: string;
}

interface ActionResponse {
  error?: string;
  success?: boolean;
  message?: string;
  labels?: Array<{ label?: string }>;
}

interface OrderManagerModalProps {
  orderId: string;
  orderNumber: string;
  integrationId: string;
  isOpen?: boolean;
  onClose: () => void;
}

export function OrderManagerModal({
  orderId,
  orderNumber,
  integrationId,
  isOpen = true,
  onClose,
}: OrderManagerModalProps) {
  const [items, setItems] = useState<JumiaOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [labelUrls, setLabelUrls] = useState<string[]>([]);
  const [blockedLabelUrl, setBlockedLabelUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/marketplace/jumia/orders/${encodeURIComponent(orderId)}/items?integrationId=${encodeURIComponent(integrationId)}`
      );
      if (!res.ok) throw new Error('Failed to fetch items');
      const data = await res.json();
      setItems(data && Array.isArray(data.items) ? data.items : []);
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
  }, [isOpen, orderId, integrationId]);

  const handleAction = async (
    action: 'pack' | 'ready_to_ship' | 'print_label' | 'cancel'
  ) => {
    setLabelUrls([]);
    setBlockedLabelUrl(null);
    setActionLoading(action);
    try {
      const res = await fetchWithCsrf('/api/marketplace/jumia/actions', {
        method: 'POST',
        body: JSON.stringify({
          action,
          integrationId,
          orderId,
          itemIds: items.map((i) => i.id),
        }),
      });

      let data: ActionResponse;
      let jsonParsed = true;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        jsonParsed = false;
        const MAX_RAW_LENGTH = 200;
        const sanitized = stripHtmlTags(text).slice(0, MAX_RAW_LENGTH);
        data = { error: sanitized } as ActionResponse;
      }

      if (!res.ok) throw new Error(data.error || 'Action failed');

      // Treat non-JSON 200 responses as failures
      if (!jsonParsed) {
        throw new Error(
          data.error || 'Server returned an unexpected non-JSON response'
        );
      }

      if (action !== 'print_label') {
        toast({
          title: 'Success',
          description: data.message || 'Action completed',
        });
        fetchItems();
        return;
      }

      // print_label path
      if (!data.labels || data.labels.length === 0) {
        toast({
          title: 'No Labels',
          description: data.labels
            ? 'No labels were generated for this order.'
            : 'No labels returned for this order.',
        });
        fetchItems();
        return;
      }

      const validLabels = data.labels.filter(
        (entry): entry is { label: string } =>
          typeof entry.label === 'string' && isValidHttpUrl(entry.label)
      );

      if (validLabels.length === 1) {
        const popup = window.open(
          validLabels[0].label,
          '_blank',
          'noopener,noreferrer'
        );
        if (!popup) {
          setBlockedLabelUrl(validLabels[0].label);
        }
      }

      setLabelUrls(validLabels.map((entry) => entry.label));
      const count = validLabels.length;
      toast({
        title: 'Labels Generated',
        description: `${count} label${count === 1 ? '' : 's'} ready`,
      });
      fetchItems();
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
            <div className="w-10 h-10 relative shrink-0 border border-gray-100 rounded-md overflow-hidden bg-white">
              <Image
                src="/jumia-logo.png"
                alt="Jumia Logo"
                fill
                sizes="40px"
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
                  <div className="h-12 w-12 bg-gray-200 rounded overflow-hidden shrink-0">
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
                    {item.trackingNumber && (
                      <p className="text-xs text-gray-400">
                        Tracking:{' '}
                        {isValidHttpUrl(item.trackingUrl) ? (
                          <a
                            href={item.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-blue-500 hover:text-blue-700"
                          >
                            {item.trackingNumber}
                          </a>
                        ) : (
                          item.trackingNumber
                        )}
                      </p>
                    )}
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

              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => handleAction('ready_to_ship')}
                disabled={!!actionLoading}
              >
                {actionLoading === 'ready_to_ship' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="mr-2 h-4 w-4" />
                )}
                Ready to Ship
              </Button>

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

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!!actionLoading} variant="destructive">
                    {actionLoading === 'cancel' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <X className="mr-2 h-4 w-4" />
                    )}
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Cancel all items in this order?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All items in order #
                      {orderNumber} will be cancelled on Jumia.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Go Back</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleAction('cancel')}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Cancel Order
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {blockedLabelUrl && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Popup Blocked</AlertTitle>
                <AlertDescription>
                  Your browser blocked the label popup.{' '}
                  <a
                    href={blockedLabelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline text-blue-600 hover:text-blue-800"
                  >
                    Click here to open the label
                  </a>
                  .
                </AlertDescription>
              </Alert>
            )}

            {labelUrls.length > 0 && (
              <div className="space-y-1 pt-2 border-t">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Shipping Labels:
                </p>
                <ul className="space-y-1">
                  {labelUrls.map((url, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: index needed to handle duplicate label URLs
                    <li key={`${url}-${index}`}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 underline break-all"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-gray-500 text-center">
              Actions apply to all items in this order. Shipment provider is
              auto-selected during packing.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
