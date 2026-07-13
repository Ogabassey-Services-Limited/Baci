import { jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { useImeiRequestIdentity } from './use-imei-request-identity';

describe('useImeiRequestIdentity', () => {
  it('reuses an idempotency key for the same identifier and tier', () => {
    const createKey = jest
      .fn<() => string>()
      .mockReturnValueOnce('key-1')
      .mockReturnValueOnce('key-2');
    const { result } = renderHook(() => useImeiRequestIdentity(createKey));

    expect(result.current.get('blacklist', '490154203237518')).toBe('key-1');
    expect(result.current.get('blacklist', '490154203237518')).toBe('key-1');
    act(() => result.current.clear());
    expect(result.current.get('blacklist', '490154203237518')).toBe('key-2');
  });
});
