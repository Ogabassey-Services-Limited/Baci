import { describe, expect, it } from 'vitest';
import { mergeStaffPermissions } from './staff-permissions-merge';

describe('mergeStaffPermissions', () => {
  it('keeps default resources that the custom object does not mention', () => {
    const defaults = {
      orders: { view: true, edit: true },
      products: { view: true },
    };
    const custom = { settings: { view: true } };

    const merged = mergeStaffPermissions(defaults, custom);

    expect(merged.orders).toEqual({ view: true, edit: true });
    expect(merged.products).toEqual({ view: true });
    expect(merged.settings).toEqual({ view: true });
  });

  it('adds a resource present only in the custom overrides', () => {
    const merged = mergeStaffPermissions(
      { orders: { view: true } },
      { marketing: { create: true } }
    );

    expect(merged.marketing).toEqual({ create: true });
  });

  it('lets an explicit custom action override the matching default', () => {
    const merged = mergeStaffPermissions(
      { orders: { view: true, edit: true } },
      { orders: { edit: false } }
    );

    // The specific action is overridden, siblings are preserved.
    expect(merged.orders).toEqual({ view: true, edit: false });
  });

  it('treats null or undefined inputs as empty maps', () => {
    expect(mergeStaffPermissions(null, null)).toEqual({});
    expect(mergeStaffPermissions(undefined, { staff: { view: true } })).toEqual(
      {
        staff: { view: true },
      }
    );
    expect(mergeStaffPermissions({ staff: { view: true } }, undefined)).toEqual(
      {
        staff: { view: true },
      }
    );
  });

  describe('bugfix: shallow merge dropped default sibling actions', () => {
    it('preserves integrations.view when custom only grants integrations.manage', () => {
      // Arrange: the exact divergence that made scoped writes pass app auth but
      // no-op under the shallow-merge RPC (integrations object replaced whole).
      const defaults = { integrations: { view: true } };
      const custom = { integrations: { manage: true } };

      // Act
      const merged = mergeStaffPermissions(defaults, custom);

      // Assert: view is retained (deep merge), not clobbered (shallow merge).
      expect(merged.integrations).toEqual({ view: true, manage: true });
    });
  });
});
