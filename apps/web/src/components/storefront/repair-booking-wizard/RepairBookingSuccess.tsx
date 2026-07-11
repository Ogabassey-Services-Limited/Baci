import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface RepairBookingSuccessProps {
  merchantName: string;
  ticketNumber: number | null;
}

/**
 * Post-submit confirmation state: ticket number + next-steps copy. Pure
 * presentational — no react-hook-form dependency.
 */
export function RepairBookingSuccess({
  merchantName,
  ticketNumber,
}: RepairBookingSuccessProps) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle className="size-10 text-green-600" />
      </div>
      <h2 className="mb-2 text-2xl font-bold">Booking Confirmed!</h2>
      {ticketNumber !== null && (
        <p className="mb-2 font-semibold">Ticket #{ticketNumber}</p>
      )}
      <p className="mb-8 text-muted-foreground">
        Thanks for booking a repair with {merchantName}. Your ticket number will
        be sent to your email. We'll be in touch shortly to confirm the details.
      </p>
      <Button asChild>
        <Link href="/">Back to Store</Link>
      </Button>
    </div>
  );
}
