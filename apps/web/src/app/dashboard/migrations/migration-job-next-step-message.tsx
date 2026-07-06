import { CheckCircle2, Mail } from 'lucide-react';
import type { ImportJobDetail } from '@/app/dashboard/migrations/migration-types';

interface MigrationJobNextStepMessageProps {
  job: ImportJobDetail;
}

export default function MigrationJobNextStepMessage({
  job,
}: MigrationJobNextStepMessageProps) {
  if (job.status !== 'committed') {
    return null;
  }

  if (job.entity_type !== 'orders' || !job.canNotify) {
    return (
      <div className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-emerald-700">
            Import complete
          </p>
          <p className="text-sm text-muted-foreground">
            The imported records are now available in Baci.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-emerald-700">
          Import complete
        </p>
        <p className="text-sm text-muted-foreground">
          Orders are now in Baci. Click{' '}
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Notify Customers
          </span>{' '}
          to send receipt emails to customers.
        </p>
      </div>
    </div>
  );
}
