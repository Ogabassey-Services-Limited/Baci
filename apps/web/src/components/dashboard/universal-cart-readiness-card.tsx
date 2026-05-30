import { ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type {
  UniversalCartCheckId,
  UniversalCartReadinessResult,
  UniversalCartReadinessStatus,
} from '@/lib/agentic/agent-commerce-health-monitor';

interface UniversalCartReadinessCardProps {
  readiness: UniversalCartReadinessResult | null;
}

export function UniversalCartReadinessCard({
  readiness,
}: UniversalCartReadinessCardProps) {
  if (!readiness) {
    return (
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="size-5 text-primary" />
            Universal Cart readiness
          </CardTitle>
          <CardDescription>Readiness data is unavailable.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const cart = getCheckStatus(readiness, ['ucp_cart_capability']);
  const catalog = getCheckStatus(readiness, [
    'ucp_catalog_search_capability',
    'ucp_catalog_lookup_capability',
  ]);
  const checkout = getCheckStatus(readiness, [
    'ucp_checkout_capability',
    'ucp_order_capability',
  ]);
  const payment = getCheckStatus(readiness, ['payment_handler_configured']);

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingCart className="size-5 text-primary" />
          Universal Cart readiness
          <StatusBadge status={readiness.status} />
        </CardTitle>
        <CardDescription>{readiness.url}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <ReadinessRow label="Cart" status={cart} />
        <ReadinessRow label="Catalog" status={catalog} />
        <ReadinessRow label="Checkout" status={checkout} />
        <ReadinessRow label="Payment" status={payment} />
        <div className="sm:col-span-2 text-sm text-muted-foreground">
          Last checked:{' '}
          <time dateTime={readiness.lastCheckedAt}>
            {readiness.lastCheckedAt}
          </time>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadinessRow({
  label,
  status,
}: {
  label: string;
  status: UniversalCartReadinessStatus;
}) {
  return (
    <fieldset
      aria-label={`${label}: ${status}`}
      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
    >
      <span className="font-medium">{label}</span>
      <StatusBadge status={status} />
    </fieldset>
  );
}

function StatusBadge({ status }: { status: UniversalCartReadinessStatus }) {
  const variant =
    status === 'fail'
      ? 'destructive'
      : status === 'warn'
        ? 'outline'
        : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

function getCheckStatus(
  readiness: UniversalCartReadinessResult,
  ids: UniversalCartCheckId[]
): UniversalCartReadinessStatus {
  const matchingChecks = readiness.checks.filter((check) =>
    ids.includes(check.id)
  );
  if (matchingChecks.some((check) => check.status === 'fail')) return 'fail';
  if (matchingChecks.some((check) => check.status === 'warn')) return 'warn';
  return 'pass';
}
