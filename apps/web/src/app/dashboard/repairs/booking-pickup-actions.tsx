'use client';

import { ExternalLink, Loader2, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestPickup } from './bookings-api';

interface BookingPickupActionsProps {
  bookingId: string;
  trackingNumber: string | null;
  onChanged: () => void;
}

export function BookingPickupActions({
  bookingId,
  trackingNumber,
  onChanged,
}: BookingPickupActionsProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [canManual, setCanManual] = useState(false);

  const handleAuto = () => {
    setLoading(true);
    setMessage(null);
    setCanManual(false);
    requestPickup(bookingId, 'auto')
      .then((response) => {
        const result = response.result;
        if (result?.ok) {
          setMessage(`Courier pickup booked (${result.trackingNumber}).`);
          onChanged();
        } else if (result) {
          setMessage(result.message);
          setCanManual(result.canRetryManually);
        } else {
          setMessage('Could not arrange courier pickup.');
          setCanManual(true);
        }
      })
      .catch(() => {
        setMessage('Could not arrange courier pickup. Please try again.');
        setCanManual(true);
      })
      .finally(() => setLoading(false));
  };

  const handleManual = () => {
    setLoading(true);
    requestPickup(bookingId, 'manual')
      .then(() => {
        setMessage('Marked as pickup arranged manually.');
        setCanManual(false);
        onChanged();
      })
      .catch(() => setMessage('Could not save. Please try again.'))
      .finally(() => setLoading(false));
  };

  if (trackingNumber) {
    return (
      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <p className="font-medium">Courier pickup booked</p>
        <Link
          className="mt-1 inline-flex items-center gap-1 text-primary underline"
          href={`/track/${encodeURIComponent(trackingNumber)}`}
        >
          Track {trackingNumber}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        disabled={loading}
        onClick={handleAuto}
        type="button"
        variant="outline"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Truck className="h-4 w-4" aria-hidden="true" />
        )}
        Request courier pickup
      </Button>
      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}
      {canManual ? (
        <Button
          disabled={loading}
          onClick={handleManual}
          size="sm"
          type="button"
          variant="ghost"
        >
          Mark pickup arranged manually
        </Button>
      ) : null}
    </div>
  );
}
