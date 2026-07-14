import { describe, expect, it } from 'vitest';
import { permissionGrantsAccess } from './permission-grant';

describe('permissionGrantsAccess', () => {
  it.each([
    ['full access', { full_access: { all: true } }, 'orders', 'delete'],
    ['global wildcard', { '*': { '*': true } }, 'orders', 'delete'],
    ['global action', { '*': { view: true } }, 'orders', 'view'],
    ['resource wildcard', { orders: { '*': true } }, 'orders', 'delete'],
    ['legacy resource all', { orders: { all: true } }, 'orders', 'delete'],
    ['exact action', { orders: { view: true } }, 'orders', 'view'],
  ])('accepts the %s grant shape', (_name, permissions, resource, action) => {
    expect(permissionGrantsAccess(permissions, resource, action)).toBe(true);
  });

  it.each([
    ['missing permissions', undefined],
    ['null permissions', null],
    ['different action', { orders: { view: true } }],
    ['explicit false', { orders: { edit: false } }],
  ])('denies %s', (_name, permissions) => {
    expect(permissionGrantsAccess(permissions, 'orders', 'edit')).toBe(false);
  });
});
