import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { AdminMerchantHealthRow } from '@/types/admin-merchants';

type MerchantHealthStatus =
  | AdminMerchantHealthRow['health_status']
  | (string & {});
const UNKNOWN_HEALTH_STATUS_LABEL = 'Unknown';

function StatusBadge({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <Badge
      aria-label={label}
      className={className}
      role="status"
      variant="outline"
    >
      {children}
    </Badge>
  );
}

export function MerchantHealthBadge({
  status,
}: {
  status: MerchantHealthStatus | null | undefined;
}) {
  switch (status) {
    case 'healthy':
      return (
        <StatusBadge
          className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
          label="Healthy"
        >
          <CheckCircle className="mr-1 h-3 w-3" aria-hidden="true" />
          Healthy
        </StatusBadge>
      );
    case 'at_risk':
      return (
        <StatusBadge
          className="border-amber-500/20 bg-amber-500/10 text-amber-600"
          label="At Risk"
        >
          <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
          At Risk
        </StatusBadge>
      );
    case 'churned':
      return (
        <StatusBadge
          className="border-destructive/20 bg-destructive/10 text-destructive"
          label="Churned"
        >
          <XCircle className="mr-1 h-3 w-3" aria-hidden="true" />
          Churned
        </StatusBadge>
      );
    case 'new':
      return (
        <StatusBadge
          className="border-indigo-500/20 bg-indigo-500/10 text-indigo-600"
          label="New"
        >
          <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
          New
        </StatusBadge>
      );
    default:
      return (
        <StatusBadge label={status || UNKNOWN_HEALTH_STATUS_LABEL}>
          {status || UNKNOWN_HEALTH_STATUS_LABEL}
        </StatusBadge>
      );
  }
}
