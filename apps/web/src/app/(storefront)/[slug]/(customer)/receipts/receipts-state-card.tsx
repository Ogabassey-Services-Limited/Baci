import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ReceiptsStateCardProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function ReceiptsStateCard({
  title,
  message,
  actionLabel,
  onAction,
}: ReceiptsStateCardProps) {
  return (
    <Card className="border-destructive/50" role="alert">
      <CardContent className="p-10 text-center">
        <AlertCircle className="mx-auto mb-4 h-14 w-14 text-destructive/60" />
        <h2 className="mb-2 text-lg font-semibold">{title}</h2>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <Button onClick={onAction} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
