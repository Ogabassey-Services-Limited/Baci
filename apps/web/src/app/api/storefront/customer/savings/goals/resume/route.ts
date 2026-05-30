import type { NextRequest } from 'next/server';
import { executeSavingsGoalAction } from '@/app/api/storefront/customer/savings/goals/goal-action-handler';

export function POST(request: NextRequest) {
  return executeSavingsGoalAction({
    request,
    rpcName: 'resume_customer_savings_goal',
  });
}
