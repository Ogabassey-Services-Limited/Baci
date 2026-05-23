'use client';

import '@/app/globals.css';
import { AlertCircle, ArrowLeft, Loader2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Suspense, use, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TRACKING_STATUS_CONFIG, type TrackingResult } from './tracking-status';

// =============================================================================
// TRACKING PAGE COMPONENT
// =============================================================================

interface TrackingPageProps {
  params: Promise<{ trackingNumber: string }>;
}

export default function TrackingPage(props: TrackingPageProps) {
  return (
    <Suspense fallback={<TrackingPageFallback />}>
      <TrackingPageContent {...props} />
    </Suspense>
  );
}

function TrackingPageContent({ params }: TrackingPageProps) {
  const { trackingNumber } = use(params);
  const [tracking, setTracking] = useState<TrackingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        const response = await fetch(
          `/api/shipping/track/${encodeURIComponent(trackingNumber)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to track shipment');
        }

        setTracking(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to track shipment'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTracking();
  }, [trackingNumber]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Tracking your shipment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold">Tracking Not Found</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tracking) {
    return null;
  }

  const statusConfig =
    TRACKING_STATUS_CONFIG[tracking.status] || TRACKING_STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Badge variant="outline" className="font-mono">
            {tracking.trackingNumber}
          </Badge>
        </div>

        {/* Status Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={cn('p-4 rounded-full', statusConfig.bgColor)}>
                <StatusIcon className={cn('h-8 w-8', statusConfig.color)} />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{tracking.statusLabel}</h1>
                <p className="text-muted-foreground">
                  Shipped via {tracking.carrier}
                </p>
              </div>
            </div>

            {/* Delivery Info */}
            {tracking.status === 'delivered' && tracking.actualDelivery && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <p className="text-green-700 font-medium">
                  Delivered on {formatDate(tracking.actualDelivery)}
                </p>
              </div>
            )}

            {tracking.status !== 'delivered' && tracking.estimatedDelivery && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-700">
                  <span className="font-medium">Estimated Delivery:</span>{' '}
                  {formatDate(tracking.estimatedDelivery)}
                </p>
              </div>
            )}

            {tracking.shipment?.receiverCity && (
              <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  Delivering to {tracking.shipment.receiverCity}
                  {tracking.shipment.receiverState &&
                    `, ${tracking.shipment.receiverState}`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tracking History</CardTitle>
          </CardHeader>
          <CardContent>
            {tracking.events.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No tracking updates yet. Check back soon.
              </p>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                {/* Events */}
                <div className="space-y-6">
                  {tracking.events.map((event, index) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: Tracking events from API have no stable ID
                      key={index}
                      className="relative flex gap-4"
                    >
                      {/* Dot */}
                      <div
                        className={cn(
                          'relative z-10 w-8 h-8 rounded-full flex items-center justify-center',
                          index === 0 ? 'bg-primary' : 'bg-gray-200'
                        )}
                      >
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full',
                            index === 0 ? 'bg-white' : 'bg-gray-400'
                          )}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-6">
                        <p
                          className={cn(
                            'font-medium',
                            index === 0 && 'text-primary'
                          )}
                        >
                          {event.description || event.status}
                        </p>
                        {event.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Need help with your delivery?{' '}
              <a
                href="mailto:support@usebaci.com"
                className="text-primary underline"
              >
                Contact Support
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TrackingPageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4" role="status" aria-live="polite">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Tracking your shipment...</p>
      </div>
    </div>
  );
}
