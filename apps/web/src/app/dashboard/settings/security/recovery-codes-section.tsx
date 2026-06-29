import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getRecoveryCodesStatusAction } from './recovery-codes-actions';
import { RecoveryCodesCard } from './recovery-codes-card';

export async function RecoveryCodesSection() {
  const status = await getRecoveryCodesStatusAction();
  return <RecoveryCodesCard initialCount={status.count} />;
}

export function RecoveryCodesSkeleton() {
  return (
    <Card className="glass" aria-label="Loading recovery codes">
      <CardHeader>
        <CardTitle>Recovery codes</CardTitle>
        <CardDescription>Loading recovery-code status…</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-10 rounded-md bg-muted" />
      </CardContent>
    </Card>
  );
}
