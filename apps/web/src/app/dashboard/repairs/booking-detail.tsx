'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RepairBookingDetail } from '@/lib/repairs/booking-mappers';
import {
  getAllowedNextRepairStatuses,
  REPAIR_STATUS_LABELS,
} from '@/lib/repairs/repair-status';
import { BookingPickupActions } from './booking-pickup-actions';
import { BookingStatusBadge } from './booking-status-badge';
import { getBooking, updateBooking } from './bookings-api';

interface BookingDetailProps {
  bookingId: string;
  canEdit?: boolean;
  onUpdated: () => void;
}

export function BookingDetail({
  bookingId,
  canEdit = true,
  onUpdated,
}: BookingDetailProps) {
  const [booking, setBooking] = useState<RepairBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const applyBooking = (next: RepairBookingDetail) => {
    setBooking(next);
    setEstimatedCost(
      next.estimatedCost == null ? '' : String(next.estimatedCost)
    );
    setAdminNotes(next.adminNotes ?? '');
    setNextStatus('');
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: applyBooking is a stable local helper; reload only when the booking id changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBooking(bookingId)
      .then(({ booking: loaded }) => {
        if (!cancelled) {
          applyBooking(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load booking.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const handleStatus = () => {
    if (!nextStatus) {
      return;
    }
    setSaving(true);
    updateBooking(bookingId, { status: nextStatus })
      .then(({ booking: updated }) => {
        applyBooking(updated);
        onUpdated();
      })
      .catch(() => setError('Failed to update status.'))
      .finally(() => setSaving(false));
  };

  const handleSaveDetails = () => {
    setSaving(true);
    updateBooking(bookingId, {
      estimated_cost: estimatedCost === '' ? null : Number(estimatedCost),
      admin_notes: adminNotes.trim() === '' ? null : adminNotes.trim(),
    })
      .then(({ booking: updated }) => {
        applyBooking(updated);
        onUpdated();
      })
      .catch(() => setError('Failed to save details.'))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (error && !booking) {
    return <p className="py-6 text-destructive text-sm">{error}</p>;
  }

  if (!booking) {
    return null;
  }

  const allowedNext = getAllowedNextRepairStatuses(booking.status);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">
            Ticket #{booking.ticketNumber}
          </p>
          <h3 className="font-semibold text-lg">{booking.deviceLabel}</h3>
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>

      <section className="space-y-1 text-sm">
        <p className="text-muted-foreground">{booking.issueDescription}</p>
        <p>
          <span className="text-muted-foreground">Customer: </span>
          {booking.customerName} · {booking.customerEmail} ·{' '}
          {booking.customerPhone}
        </p>
        {booking.repairTypeLabel ? (
          <p>
            <span className="text-muted-foreground">Service: </span>
            {booking.repairTypeLabel}
          </p>
        ) : null}
        {booking.pickupAddress ? (
          <p>
            <span className="text-muted-foreground">Pickup: </span>
            {booking.pickupAddress}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <Label htmlFor="booking-next-status">Advance status</Label>
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            disabled={!canEdit || allowedNext.length === 0}
            id="booking-next-status"
            onChange={(event) => setNextStatus(event.target.value)}
            value={nextStatus}
          >
            <option value="">
              {allowedNext.length === 0 ? 'No further transitions' : 'Select…'}
            </option>
            {allowedNext.map((status) => (
              <option key={status} value={status}>
                {REPAIR_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <Button
            disabled={!canEdit || saving || !nextStatus}
            onClick={handleStatus}
            type="button"
          >
            Update
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="booking-estimated-cost">Estimated cost (₦)</Label>
          <Input
            id="booking-estimated-cost"
            inputMode="decimal"
            onChange={(event) => setEstimatedCost(event.target.value)}
            placeholder="e.g. 25000"
            readOnly={!canEdit}
            value={estimatedCost}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="booking-admin-notes">Internal notes</Label>
          <Textarea
            id="booking-admin-notes"
            onChange={(event) => setAdminNotes(event.target.value)}
            readOnly={!canEdit}
            rows={3}
            value={adminNotes}
          />
        </div>
        <Button
          disabled={!canEdit || saving}
          onClick={handleSaveDetails}
          type="button"
        >
          Save details
        </Button>
      </section>

      {booking.serviceType === 'pickup' &&
      (canEdit || booking.trackingNumber) ? (
        <section className="space-y-2">
          <h4 className="font-medium text-sm">Courier pickup</h4>
          <BookingPickupActions
            bookingId={booking.id}
            canEdit={canEdit}
            onChanged={onUpdated}
            trackingNumber={booking.trackingNumber}
          />
        </section>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
