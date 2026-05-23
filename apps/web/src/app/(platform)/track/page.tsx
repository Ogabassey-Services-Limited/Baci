'use client';

import { ArrowLeft, Package, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function TrackPage() {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      setIsLoading(true);
      router.push(`/track/${encodeURIComponent(trackingNumber.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Back Link */}
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        {/* Main Card */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-primary" />
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
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
                disabled={!trackingNumber.trim() || isLoading}
              >
                {isLoading ? 'Tracking...' : 'Track Shipment'}
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
