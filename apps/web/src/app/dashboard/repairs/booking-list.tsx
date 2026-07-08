'use client';

import { Loader2 } from 'lucide-react';
import type { RepairBookingSummary } from '@/lib/repairs/booking-mappers';
import {
  REPAIR_STATUS_LABELS,
  REPAIR_STATUSES,
} from '@/lib/repairs/repair-status';
import { BookingStatusBadge } from './booking-status-badge';

interface BookingListProps {
  bookings: RepairBookingSummary[];
  loading: boolean;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onSelect: (id: string) => void;
}

function formatMoney(value: number | null): string {
  if (value == null) {
    return '—';
  }
  return `₦${value.toLocaleString()}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

export function BookingList({
  bookings,
  loading,
  statusFilter,
  onStatusFilterChange,
  onSelect,
}: BookingListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm" htmlFor="booking-status-filter">
          Status
        </label>
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          id="booking-status-filter"
          onChange={(event) => onStatusFilterChange(event.target.value)}
          value={statusFilter}
        >
          <option value="">All</option>
          {REPAIR_STATUSES.map((status) => (
            <option key={status} value={status}>
              {REPAIR_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : bookings.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground text-sm">
          No repair bookings yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Ticket</th>
                <th className="py-2 pr-4 font-medium">Device</th>
                <th className="py-2 pr-4 font-medium">Service</th>
                <th className="py-2 pr-4 font-medium">Quoted</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr
                  className="cursor-pointer border-b hover:bg-muted/50"
                  key={booking.id}
                >
                  <td className="py-2 pr-4">
                    <button
                      className="font-medium text-primary underline"
                      onClick={() => onSelect(booking.id)}
                      type="button"
                    >
                      #{booking.ticketNumber}
                    </button>
                  </td>
                  <td className="py-2 pr-4">{booking.deviceLabel}</td>
                  <td className="py-2 pr-4">
                    {booking.repairTypeLabel ?? '—'}
                  </td>
                  <td className="py-2 pr-4">
                    {formatMoney(booking.quotedPrice)}
                  </td>
                  <td className="py-2 pr-4">
                    <BookingStatusBadge status={booking.status} />
                  </td>
                  <td className="py-2 pr-4">{formatDate(booking.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
