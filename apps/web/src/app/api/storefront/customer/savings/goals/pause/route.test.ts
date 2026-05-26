import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecuteSavingsGoalAction = vi.fn();

vi.mock(
  '@/app/api/storefront/customer/savings/goals/goal-action-handler',
  () => ({
    executeSavingsGoalAction: (...args: unknown[]) =>
      mockExecuteSavingsGoalAction(...args),
  })
);

import { POST } from './route';

describe('POST /api/storefront/customer/savings/goals/pause', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to goal action handler with pause rpc', async () => {
    mockExecuteSavingsGoalAction.mockResolvedValue(
      NextResponse.json({ success: true })
    );
    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockExecuteSavingsGoalAction).toHaveBeenCalledWith({
      request,
      rpcName: 'pause_customer_savings_goal',
    });
  });

  it.each([
    401, 400, 500,
  ])('forwards %i responses from the handler', async (status) => {
    mockExecuteSavingsGoalAction.mockResolvedValue(
      NextResponse.json({ error: `status-${status}` }, { status })
    );
    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body).toEqual({ error: `status-${status}` });
  });
});
