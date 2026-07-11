import { CheckCircle2, Clock, Cog, Wrench, XCircle } from 'lucide-react';
import type { ReactElement } from 'react';
import { isRepairStatus } from '@/lib/repairs/repair-status';

/**
 * Maps a repair status to a lucide icon. Kept separate from the pure
 * `repair-status` module so server routes can import the transition/colour
 * logic without pulling in React/JSX.
 */
export function getRepairStatusIcon(status: string, size = 16): ReactElement {
  if (!isRepairStatus(status)) {
    return <Wrench size={size} aria-hidden="true" />;
  }

  switch (status) {
    case 'pending':
      return <Clock size={size} aria-hidden="true" />;
    case 'confirmed':
      return <CheckCircle2 size={size} aria-hidden="true" />;
    case 'in_progress':
      return <Cog size={size} aria-hidden="true" />;
    case 'completed':
      return <CheckCircle2 size={size} aria-hidden="true" />;
    case 'cancelled':
      return <XCircle size={size} aria-hidden="true" />;
    default:
      return <XCircle size={size} aria-hidden="true" />;
  }
}
