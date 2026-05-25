import type { NextRequest } from 'next/server';
import { executeSavingsGoalAction } from '@/app/api/storefront/customer/savings/goals/goal-action-handler';

export function POST(request: NextRequest) {
  return executeSavingsGoalAction({
    request,
    rpcName: 'cancel_customer_savings_goal_future_debits',
  });
}
