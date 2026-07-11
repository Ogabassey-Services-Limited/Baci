import { Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type RepairsUnavailableReason =
  | 'permission'
  | 'business-type'
  | 'disabled';

const MESSAGES: Record<
  RepairsUnavailableReason,
  { title: string; body: string }
> = {
  permission: {
    title: 'No access to repairs',
    body: 'You do not have permission to view the repairs catalogue. Ask a store owner or admin to grant you the repairs permission.',
  },
  'business-type': {
    title: 'Repairs is for electronics stores',
    body: 'The repairs catalogue is available for electronics and gadgets stores. Update your business type to enable it.',
  },
  disabled: {
    title: 'Repairs catalogue is off',
    body: 'Turn on the repairs catalogue in your store feature settings to start listing devices, service types, and prices.',
  },
};

export default function RepairsUnavailable({
  reason,
}: {
  reason: RepairsUnavailableReason;
}) {
  const message = MESSAGES[reason];
  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" aria-hidden="true" />
            {message.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{message.body}</p>
        </CardContent>
      </Card>
    </div>
  );
}
