import type { OrderSource } from '@baci/shared';

export interface UseNewOrderControllerOptions {
  autoApplyVat?: boolean;
  autoSelectDefaultBranch?: boolean;
  initialSelectedChannel?: OrderSource | null;
}
