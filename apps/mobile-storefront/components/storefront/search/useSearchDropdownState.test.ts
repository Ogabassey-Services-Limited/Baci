import { act, renderHook } from '@testing-library/react-native';
import { useSearchDropdownState } from './useSearchDropdownState';

jest.mock('@/hooks', () => ({
  useDebounce: (value: string) => value,
}));

describe('useSearchDropdownState', () => {
  it('uses internal state when uncontrolled', () => {
    const { result } = renderHook(() => useSearchDropdownState({}));

    expect(result.current.activeQuery).toBe('');
    act(() => {
      result.current.setQuery('  iphone  ');
    });

    expect(result.current.activeQuery).toBe('  iphone  ');
    expect(result.current.effectiveQuery).toBe('iphone');
    expect(result.current.isControlled).toBe(false);
  });

  it('uses external value and callback when controlled', () => {
    const onExternalQueryChange = jest.fn();
    const { result } = renderHook(() =>
      useSearchDropdownState({
        externalQuery: 'galaxy',
        onExternalQueryChange,
      })
    );

    act(() => {
      result.current.setQuery('pixel');
    });

    expect(result.current.activeQuery).toBe('galaxy');
    expect(result.current.effectiveQuery).toBe('galaxy');
    expect(result.current.isControlled).toBe(true);
    expect(onExternalQueryChange).toHaveBeenCalledWith('pixel');
  });
});
