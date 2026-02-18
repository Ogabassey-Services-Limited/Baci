import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistedForm, usePersistedState } from './use-persisted-state';

describe('usePersistedState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value when no stored data', () => {
    const { result } = renderHook(() => usePersistedState('test', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('reads from sessionStorage on mount', () => {
    sessionStorage.setItem('test', JSON.stringify('stored-value'));
    const { result } = renderHook(() => usePersistedState('test', 'default'));
    expect(result.current[0]).toBe('stored-value');
  });

  it('writes to sessionStorage on state change', () => {
    const { result } = renderHook(() => usePersistedState('test', 'initial'));
    act(() => result.current[1]('updated'));
    vi.advanceTimersByTime(500);
    expect(JSON.parse(sessionStorage.getItem('test') as string)).toBe(
      'updated'
    );
  });

  it('supports localStorage option', () => {
    localStorage.setItem('test', JSON.stringify('from-local'));
    const { result } = renderHook(() =>
      usePersistedState('test', 'default', { storage: 'local' })
    );
    expect(result.current[0]).toBe('from-local');
  });

  it('clear removes from storage and resets state', () => {
    sessionStorage.setItem('test', JSON.stringify('stored'));
    const { result } = renderHook(() => usePersistedState('test', 'default'));
    act(() => result.current[2]());
    expect(result.current[0]).toBe('default');
    expect(sessionStorage.getItem('test')).toBeNull();
  });
});

describe('usePersistedForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial form values', () => {
    const { result } = renderHook(() =>
      usePersistedForm('form', { name: '', email: '' })
    );
    expect(result.current.values).toEqual({ name: '', email: '' });
  });

  it('setValue updates individual fields', () => {
    const { result } = renderHook(() =>
      usePersistedForm('form', { name: '', email: '' })
    );
    act(() => result.current.setValue('name', 'John'));
    expect(result.current.values.name).toBe('John');
  });

  it('setValues updates multiple fields', () => {
    const { result } = renderHook(() =>
      usePersistedForm('form', { name: '', email: '' })
    );
    act(() => result.current.setValues({ name: 'John', email: 'j@test.com' }));
    expect(result.current.values).toEqual({
      name: 'John',
      email: 'j@test.com',
    });
  });

  it('reset returns to initial values', () => {
    const { result } = renderHook(() =>
      usePersistedForm('form', { name: '', email: '' })
    );
    act(() => result.current.setValue('name', 'John'));
    act(() => result.current.reset());
    expect(result.current.values.name).toBe('');
  });
});
