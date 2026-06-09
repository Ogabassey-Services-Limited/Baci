'use client';

import { ArrowLeft, Package, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TrackPage() {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      startTransition(() => {
        router.push(`/track/${encodeURIComponent(trackingNumber.trim())}`);
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Back Link */}
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="mr-2 size-4" />
            Back to Home
          </Link>
        </Button>

        {/* Main Card */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto size-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Package className="size-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Track Your Order</CardTitle>
            <CardDescription>
              Enter your tracking number to see the delivery status of your
              shipment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Label htmlFor="tracking-number" className="sr-only">
                  Tracking Number
                </Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="tracking-number"
                  type="text"
                  placeholder="Enter tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!trackingNumber.trim() || isPending}
              >
                {isPending ? 'Tracking...' : 'Track Shipment'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Help Text */}
        <p className="text-sm text-muted-foreground text-center">
          Your tracking number was sent to your email after placing an order.
          Can&apos;t find it?{' '}
          <a
            href="mailto:support@usebaci.com"
            className="text-primary underline"
          >
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}
