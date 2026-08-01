import { SetupChecklist } from '@/components/dashboard/setup-checklist';
import { StoreBuildStatusCard } from '@/components/dashboard/store-build-status-card';

interface DashboardPageReadinessProps {
  merchantId?: string;
}

export function DashboardPageReadiness({
  merchantId,
}: DashboardPageReadinessProps) {
  if (!merchantId) return null;

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ animationFillMode: 'both' }}
    >
      <StoreBuildStatusCard merchantId={merchantId} />
      <SetupChecklist dismissible merchantId={merchantId} />
    </div>
  );
}
