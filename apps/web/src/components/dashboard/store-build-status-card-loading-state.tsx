import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface StoreBuildStatusCardLoadingStateProps {
  loadError?: string | null;
  loading?: boolean;
  onRetry?: () => void;
}

export function StoreBuildStatusCardLoadingState({
  loadError,
  loading = false,
  onRetry,
}: StoreBuildStatusCardLoadingStateProps) {
  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Checking store build status…
        </CardContent>
      </Card>
    );
  }

  if (!loadError) return null;
  return (
    <Card className="border-destructive">
      <CardContent className="pt-6">
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {loadError}
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="mr-1.5 size-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
