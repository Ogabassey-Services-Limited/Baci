import { describe, expect, it, vi } from 'vitest';
import { createDeliveryStartBoundary } from './push-delivery-boundary';

describe('createDeliveryStartBoundary', () => {
  it('runs the callback once after it completes successfully', async () => {
    const onDeliveryStart = vi.fn().mockResolvedValue(undefined);
    const markDeliveryStarted = createDeliveryStartBoundary(onDeliveryStart);

    await markDeliveryStarted();
    await markDeliveryStarted();

    expect(onDeliveryStart).toHaveBeenCalledOnce();
  });

  it('allows a retry when the callback fails before the boundary is committed', async () => {
    const onDeliveryStart = vi
      .fn()
      .mockRejectedValueOnce(new Error('lease unavailable'))
      .mockResolvedValueOnce(undefined);
    const markDeliveryStarted = createDeliveryStartBoundary(onDeliveryStart);

    await expect(markDeliveryStarted()).rejects.toThrow('lease unavailable');
    await markDeliveryStarted();

    expect(onDeliveryStart).toHaveBeenCalledTimes(2);
  });
});
