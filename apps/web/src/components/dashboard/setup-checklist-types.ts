import type {
  StoreReadinessItem,
  WebStoreReadiness,
  WebStoreReadinessItemId,
} from '@baci/shared';
import type { Dispatch, SetStateAction } from 'react';

export type SetupItem = StoreReadinessItem<WebStoreReadinessItemId>;

export interface SetupChecklistContentProps {
  compact: boolean;
  displayItems: SetupItem[];
  incompleteItems: SetupItem[];
  readiness: WebStoreReadiness;
  requiredIncomplete: SetupItem[];
  setShowAll: Dispatch<SetStateAction<boolean>>;
  showAll: boolean;
}
