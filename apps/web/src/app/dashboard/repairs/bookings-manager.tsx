'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RepairBookingSummary } from '@/lib/repairs/booking-mappers';
import { BookingDetail } from './booking-detail';
import { BookingList } from './booking-list';
import { listBookings } from './bookings-api';
import { RepairSettingsCard } from './repair-settings-card';

export default function BookingsManager() {
  const [bookings, setBookings] = useState<RepairBookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an intentional reload trigger, not a value read in the effect
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBookings({ status: statusFilter || undefined })
      .then(({ bookings: rows }) => {
        if (!cancelled) {
          setBookings(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBookings([]);
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
  }, [statusFilter, refreshKey]);

  const refresh = () => setRefreshKey((key) => key + 1);

  return (
    <div className="mt-4 space-y-6">
      <RepairSettingsCard />

      <BookingList
        bookings={bookings}
        loading={loading}
        onSelect={setSelectedId}
        onStatusFilterChange={setStatusFilter}
        statusFilter={statusFilter}
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
        open={selectedId !== null}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Repair booking</DialogTitle>
          </DialogHeader>
          {selectedId ? (
            <BookingDetail bookingId={selectedId} onUpdated={refresh} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
