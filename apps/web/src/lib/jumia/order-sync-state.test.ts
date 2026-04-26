import { describe, expect, it } from 'vitest';
import {
  clearFullFailureState,
  FULL_FAILURE_SYNC_CONFIG_KEY,
  readFullFailureState,
  withFullFailureState,
} from '@/lib/jumia/order-sync-state';

describe('Jumia order sync failure state', () => {
  it('stores and reads full failure retry state without dropping other config', () => {
    const updatedAt = '2026-04-25T12:00:00.000Z';
    const config = withFullFailureState(
      { orders: true },
      'cursor-1',
      2,
      updatedAt
    );

    expect(config.orders).toBe(true);
    expect(config[FULL_FAILURE_SYNC_CONFIG_KEY]).toEqual(
      expect.objectContaining({ updated_at: updatedAt })
    );
    expect(readFullFailureState(config)).toEqual({
      cursor: 'cursor-1',
      count: 2,
    });
  });

  it('accepts zero as a valid full failure retry count', () => {
    const config = withFullFailureState({ orders: true }, 'c1', 0);

    expect(readFullFailureState(config)).toEqual({ cursor: 'c1', count: 0 });
  });

  it('clears only the full failure state key', () => {
    const config = withFullFailureState({ orders: true }, 'cursor-1', 2);

    expect(clearFullFailureState(config)).toEqual({ orders: true });
    expect(clearFullFailureState({ orders: true })).toEqual({ orders: true });
    expect(clearFullFailureState(null)).toEqual({});
    expect(clearFullFailureState(undefined)).toEqual({});
    expect(clearFullFailureState([])).toEqual({});
  });

  it.each([
    ['missing cursor', { [FULL_FAILURE_SYNC_CONFIG_KEY]: { count: 2 } }],
    ['missing count', { [FULL_FAILURE_SYNC_CONFIG_KEY]: { cursor: 'c1' } }],
    [
      'count is string',
      { [FULL_FAILURE_SYNC_CONFIG_KEY]: { cursor: 'c1', count: 'two' } },
    ],
    [
      'count is negative',
      { [FULL_FAILURE_SYNC_CONFIG_KEY]: { cursor: 'c1', count: -1 } },
    ],
    [
      'cursor is number',
      { [FULL_FAILURE_SYNC_CONFIG_KEY]: { cursor: 1, count: 2 } },
    ],
    ['failure state is null', { [FULL_FAILURE_SYNC_CONFIG_KEY]: null }],
    ['config is undefined', undefined],
    ['config is null', null],
    ['config is array', []],
    ['failure state is array', { [FULL_FAILURE_SYNC_CONFIG_KEY]: [] }],
    [
      'cursor is empty string',
      { [FULL_FAILURE_SYNC_CONFIG_KEY]: { cursor: '', count: 0 } },
    ],
    [
      'cursor is whitespace',
      { [FULL_FAILURE_SYNC_CONFIG_KEY]: { cursor: '   ', count: 0 } },
    ],
    [
      'count is fractional',
      { [FULL_FAILURE_SYNC_CONFIG_KEY]: { cursor: 'c1', count: 1.5 } },
    ],
    [
      'count is NaN',
      { [FULL_FAILURE_SYNC_CONFIG_KEY]: { cursor: 'c1', count: Number.NaN } },
    ],
    [
      'count is null',
      { [FULL_FAILURE_SYNC_CONFIG_KEY]: { cursor: 'c1', count: null } },
    ],
    [
      'count is undefined',
      { [FULL_FAILURE_SYNC_CONFIG_KEY]: { cursor: 'c1', count: undefined } },
    ],
  ])('returns null when %s', (_, config) => {
    expect(readFullFailureState(config)).toBe(null);
  });

  it('rejects invalid failure state writes', () => {
    expect(() => withFullFailureState({}, '', 1)).toThrow(
      /cursor must be a non-empty, non-whitespace string/
    );
    expect(() => withFullFailureState({}, '  ', 1)).toThrow(
      /cursor must be a non-empty, non-whitespace string/
    );
    expect(() => withFullFailureState({}, 'cursor-1', -1)).toThrow(
      /count must be a non-negative safe integer/
    );
    expect(() => withFullFailureState({}, 'cursor-1', 1.5)).toThrow(
      /count must be a non-negative safe integer/
    );
    expect(() => withFullFailureState({}, 'cursor-1', Number.NaN)).toThrow(
      /count must be a non-negative safe integer/
    );
    expect(() =>
      withFullFailureState({}, 'cursor-1', Number.POSITIVE_INFINITY)
    ).toThrow(/count must be a non-negative safe integer/);
    expect(() =>
      withFullFailureState({}, 'cursor-1', Number.MAX_SAFE_INTEGER + 1)
    ).toThrow(/count must be a non-negative safe integer/);
  });

  it('accepts Number.MAX_SAFE_INTEGER as a valid count', () => {
    const config = withFullFailureState(
      {},
      'cursor-1',
      Number.MAX_SAFE_INTEGER
    );

    expect(readFullFailureState(config)).toEqual({
      cursor: 'cursor-1',
      count: Number.MAX_SAFE_INTEGER,
    });
  });
});
