import { CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BookingsPlaceholder() {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
          Bookings are coming soon
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Repair booking management — advancing status, quoted price, and
          courier pickup — lands in a later release. For now, set up your
          catalogue so customers can request quotes.
        </p>
      </CardContent>
    </Card>
  );
}
