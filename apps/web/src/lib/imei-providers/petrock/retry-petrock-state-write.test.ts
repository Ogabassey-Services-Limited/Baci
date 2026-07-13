import { describe, expect, it, vi } from 'vitest';
import {
  isRetryablePetrockStateWriteError,
  retryPetrockStateWrite,
} from './retry-petrock-state-write';

describe('retryPetrockStateWrite', () => {
  it('retries one transient state-write failure', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockResolvedValueOnce(true);

    await expect(
      retryPetrockStateWrite(operation, isRetryablePetrockStateWriteError)
    ).resolves.toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('surfaces a second failure for manual recovery', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ code: '40001', message: 'serialization' })
      .mockRejectedValueOnce(new Error('unavailable'));

    await expect(
      retryPetrockStateWrite(operation, isRetryablePetrockStateWriteError)
    ).rejects.toThrow('unavailable');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry a deterministic validation failure', async () => {
    const failure = { code: '23514', message: 'check constraint failed' };
    const operation = vi.fn().mockRejectedValue(failure);

    await expect(
      retryPetrockStateWrite(operation, isRetryablePetrockStateWriteError)
    ).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledOnce();
  });

  it.each([
    new TypeError('network'),
    Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
    { code: '08006' },
    { code: '40P01' },
    { code: 'PGRST000' },
    { status: 503 },
  ])('classifies a transient state-write error', (error) => {
    expect(isRetryablePetrockStateWriteError(error)).toBe(true);
  });
});
