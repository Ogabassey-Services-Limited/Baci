
'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function OrderDetailsPage({ params }: { params: { orderId: string } }) {
  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <Link href="/dashboard/orders">
          <Button type="button" variant="outline" size="icon" className="h-7 w-7">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back to Orders</span>
          </Button>
        </Link>
        <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          Order Details #{params.orderId}
        </h1>
      </div>
      <div>
        <p>This page will show the details for order #{params.orderId}.</p>
        <p>Content is under construction.</p>
      </div>
    </>
  );
}
