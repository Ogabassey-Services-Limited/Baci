import { jest } from '@jest/globals';
import {
  remainingAuthStorageTimeout,
  runWithAuthStorageDeadline,
} from './auth-storage-deadline';

describe('auth storage aggregate deadline', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shares one remaining budget across sequential storage phases', async () => {
    jest.useFakeTimers();
    const operation = runWithAuthStorageDeadline(async () => {
      expect(remainingAuthStorageTimeout(4_000)).toBe(4_000);
      await jest.advanceTimersByTimeAsync(3_000);
      expect(remainingAuthStorageTimeout(4_000)).toBe(4_000);
      await jest.advanceTimersByTimeAsync(3_000);
      expect(remainingAuthStorageTimeout(4_000)).toBe(3_000);
    }, 9_000);

    await operation;
  });

  it('removes the aggregate deadline after the lifecycle settles', async () => {
    jest.useFakeTimers();
    await runWithAuthStorageDeadline(async () => undefined, 100);

    expect(remainingAuthStorageTimeout(4_000)).toBe(4_000);
  });
});
