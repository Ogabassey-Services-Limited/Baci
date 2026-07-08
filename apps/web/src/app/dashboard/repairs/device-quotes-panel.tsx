'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type {
  RepairQuoteAdmin,
  RepairServiceTypeAdmin,
} from '@/lib/repairs/catalog-admin-mappers';
import { deleteQuote, listQuotes } from './catalog-api';
import QuoteFormDialog from './quote-form-dialog';

/**
 * Expandable per-device panel listing repair quotes, embedded inside a
 * DevicesManager table row.
 */

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
});

interface DeviceQuotesPanelProps {
  deviceId: string;
  serviceTypes: RepairServiceTypeAdmin[];
}

export default function DeviceQuotesPanel({
  deviceId,
  serviceTypes,
}: DeviceQuotesPanelProps) {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<RepairQuoteAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<RepairQuoteAdmin | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadQuotes = () => {
    setLoading(true);
    setLoadError(null);
    listQuotes(deviceId)
      .then(setQuotes)
      .catch(() => {
        setLoadError('Could not load quotes.');
        toast({
          title: 'Error loading quotes',
          description: 'Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload only when the device changes; loadQuotes is recreated every render
  useEffect(() => {
    loadQuotes();
  }, [deviceId]);

  const serviceTypeName = (id: string) =>
    serviceTypes.find((type) => type.id === id)?.name ?? 'Unknown service';

  const openCreateDialog = () => {
    setEditingQuote(null);
    setDialogOpen(true);
  };

  const openEditDialog = (quote: RepairQuoteAdmin) => {
    setEditingQuote(quote);
    setDialogOpen(true);
  };

  const handleSaved = (quote: RepairQuoteAdmin) => {
    setQuotes((current) => {
      const exists = current.some((item) => item.id === quote.id);
      return exists
        ? current.map((item) => (item.id === quote.id ? quote : item))
        : [quote, ...current];
    });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteQuote(id);
      setQuotes((current) => current.filter((item) => item.id !== id));
      toast({ title: 'Quote removed' });
    } catch (error) {
      toast({
        title: 'Could not remove quote',
        description:
          error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Quotes</h3>
        <Button size="sm" variant="outline" onClick={openCreateDialog}>
          <Plus className="size-4" />
          Add quote
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button size="sm" variant="outline" onClick={loadQuotes}>
            Retry
          </Button>
        </div>
      ) : quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No quotes yet for this device.
        </p>
      ) : (
        <ul className="space-y-2">
          {quotes.map((quote) => (
            <li
              key={quote.id}
              className="flex items-start justify-between gap-4 rounded-md border bg-background p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {serviceTypeName(quote.serviceTypeId)}
                  </span>
                  <Badge variant={quote.isActive ? 'default' : 'outline'}>
                    {quote.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-sm">
                  {quote.isFromPrice ? 'From ' : ''}
                  {CURRENCY_FORMATTER.format(quote.price)}
                </p>
                {quote.partQuality ? (
                  <p className="text-muted-foreground text-xs">
                    {quote.partQuality}
                  </p>
                ) : null}
                {quote.internalNotes ? (
                  <p className="text-muted-foreground text-xs italic">
                    {quote.internalNotes}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => openEditDialog(quote)}
                >
                  <Pencil className="size-4" />
                  <span className="sr-only">
                    Edit {serviceTypeName(quote.serviceTypeId)} quote
                  </span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="outline">
                      <Trash2 className="size-4" />
                      <span className="sr-only">
                        Delete {serviceTypeName(quote.serviceTypeId)} quote
                      </span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this quote?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deletingId === quote.id}
                        onClick={() => handleDelete(quote.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}

      <QuoteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deviceId={deviceId}
        serviceTypes={serviceTypes}
        initial={editingQuote}
        onSaved={handleSaved}
      />
    </div>
  );
}
