import {
  type OrderPaymentAccountLike,
  selectPreferredOrderPaymentAccount,
} from '@baci/shared';
import { generateDvaHelpers } from '../generate-dva-helpers';

interface ReminderPaymentAccountTiming {
  assigned_at?: string | null;
  expires_at?: string | null;
}

export function selectReminderPaymentAccount<
  T extends OrderPaymentAccountLike & ReminderPaymentAccountTiming,
>(accounts: readonly T[] | null | undefined, now = new Date()): T | null {
  return selectPreferredOrderPaymentAccount(
    (accounts ?? []).filter((account) =>
      generateDvaHelpers.isActivePaymentAccount(account, now)
    )
  );
}
