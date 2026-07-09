'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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

const BOOKINGS_PAGE_SIZE = 25;

interface BookingsManagerProps {
  canEdit?: boolean;
}

export default function BookingsManager({
  canEdit = true,
}: BookingsManagerProps) {
  const [bookings, setBookings] = useState<RepairBookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalBookings, setTotalBookings] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an intentional reload trigger, not a value read in the effect
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadingMore(false);
    listBookings({
      status: statusFilter || undefined,
      limit: BOOKINGS_PAGE_SIZE,
      offset: 0,
    })
      .then(({ bookings: rows, total }) => {
        if (!cancelled) {
          setBookings(rows);
          setTotalBookings(total);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBookings([]);
          setTotalBookings(0);
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
  const canLoadMore = bookings.length < totalBookings;

  const loadMore = () => {
    setLoadingMore(true);
    listBookings({
      status: statusFilter || undefined,
      limit: BOOKINGS_PAGE_SIZE,
      offset: bookings.length,
    })
      .then(({ bookings: rows, total }) => {
        setBookings((current) => [...current, ...rows]);
        setTotalBookings(total);
      })
      .catch(() => {
        setTotalBookings(bookings.length);
      })
      .finally(() => {
        setLoadingMore(false);
      });
  };

  return (
    <div className="mt-4 space-y-6">
      <RepairSettingsCard canEdit={canEdit} />

      <BookingList
        bookings={bookings}
        loading={loading}
        onSelect={setSelectedId}
        onStatusFilterChange={setStatusFilter}
        statusFilter={statusFilter}
      />

      {!loading && canLoadMore ? (
        <div className="flex justify-center">
          <Button disabled={loadingMore} onClick={loadMore} type="button">
            {loadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      ) : null}

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
            <BookingDetail
              bookingId={selectedId}
              canEdit={canEdit}
              onUpdated={refresh}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
