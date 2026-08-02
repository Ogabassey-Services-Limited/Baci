import { describe, expect, it } from 'vitest';
import {
  createApplyRequest,
  merchantId,
  routeContext,
} from './route.test-helpers';

describe('AI job apply route test helpers', () => {
  it('builds a merchant-scoped apply request and route context', async () => {
    const request = createApplyRequest(JSON.stringify({ merchantId }));

    await expect(request.json()).resolves.toEqual({ merchantId });
    await expect(routeContext().params).resolves.toEqual({
      id: expect.any(String),
    });
  });
});
