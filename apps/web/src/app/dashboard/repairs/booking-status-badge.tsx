import {
  getRepairStatusColorClasses,
  getRepairStatusLabel,
} from '@/lib/repairs/repair-status';
import { cn } from '@/lib/utils';

export function BookingStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-xs',
        getRepairStatusColorClasses(status)
      )}
    >
      {getRepairStatusLabel(status)}
    </span>
  );
}
