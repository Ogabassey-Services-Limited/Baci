import { describe, expect, it, vi } from 'vitest';
import {
  buildSmartNavStorageKey,
  getSmartShortcutItems,
  readSmartNavUsage,
  recordSmartNavUsage,
} from './smart-nav';

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Products' },
  { id: 'seo', label: 'SEO' },
  { id: 'settings', label: 'Settings' },
];

describe('smart dashboard navigation', () => {
  it('scopes usage storage by merchant', () => {
    expect(buildSmartNavStorageKey('merchant-1')).toBe(
      'baci.dashboard.smartNav.merchant-1'
    );
  });

  it('ranks clicked items by frequency and recency while excluding stable pinned items', () => {
    const shortcuts = getSmartShortcutItems({
      items: navItems,
      now: new Date('2026-05-28T21:00:00.000Z'),
      usage: {
        dashboard: {
          clickCount: 99,
          lastClickedAt: '2026-05-28T20:00:00.000Z',
        },
        products: {
          clickCount: 4,
          lastClickedAt: '2026-05-28T20:00:00.000Z',
        },
        seo: {
          clickCount: 4,
          lastClickedAt: '2026-05-20T20:00:00.000Z',
        },
      },
    });

    expect(shortcuts.map((item) => item.id)).toEqual(['products', 'seo']);
  });

  it('places urgent items ahead of high click history', () => {
    const shortcuts = getSmartShortcutItems({
      items: navItems,
      now: new Date('2026-05-28T21:00:00.000Z'),
      urgentItemIds: ['orders'],
      usage: {
        products: {
          clickCount: 30,
          lastClickedAt: '2026-05-28T20:00:00.000Z',
        },
      },
    });

    expect(shortcuts.map((item) => item.id)).toEqual(['orders', 'products']);
  });

  it('respects empty item lists and max item boundaries', () => {
    const usage = {
      products: {
        clickCount: 3,
        lastClickedAt: '2026-05-28T20:00:00.000Z',
      },
      seo: {
        clickCount: 2,
        lastClickedAt: '2026-05-28T20:00:00.000Z',
      },
    };

    expect(getSmartShortcutItems({ items: [], usage })).toEqual([]);
    expect(
      getSmartShortcutItems({ items: navItems, maxItems: 0, usage })
    ).toEqual([]);
    expect(
      getSmartShortcutItems({ items: navItems, maxItems: 1, usage }).map(
        (item) => item.id
      )
    ).toEqual(['products']);
    expect(
      getSmartShortcutItems({ items: navItems, maxItems: 10, usage }).map(
        (item) => item.id
      )
    ).toEqual(['products', 'seo']);
  });

  it('handles invalid, future, and stale click dates without throwing', () => {
    const shortcuts = getSmartShortcutItems({
      items: navItems,
      now: new Date('2026-05-28T21:00:00.000Z'),
      usage: {
        products: {
          clickCount: 1,
          lastClickedAt: 'not-a-date',
        },
        seo: {
          clickCount: 1,
          lastClickedAt: '2026-05-29T21:00:00.000Z',
        },
        settings: {
          clickCount: 1,
          lastClickedAt: '2026-01-01T21:00:00.000Z',
        },
      },
    });

    expect(shortcuts.map((item) => item.id)).toEqual([
      'seo',
      'products',
      'settings',
    ]);
  });

  it('records usage without throwing on broken storage contents', () => {
    const storage = new Map<string, string>();
    const key = 'baci.dashboard.smartNav.merchant-1';
    const adapter = {
      getItem: (itemKey: string) => storage.get(itemKey) ?? null,
      setItem: (itemKey: string, value: string) => storage.set(itemKey, value),
    };

    storage.set(key, '{bad json');

    recordSmartNavUsage(adapter, key, 'products', {
      now: new Date('2026-05-28T21:00:00.000Z'),
    });

    expect(readSmartNavUsage(adapter, key)).toMatchObject({
      products: {
        clickCount: 1,
        lastClickedAt: '2026-05-28T21:00:00.000Z',
      },
    });
  });

  it('returns updated usage when storage writes fail', () => {
    const key = 'baci.dashboard.smartNav.merchant-1';
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const adapter = {
      getItem: () =>
        JSON.stringify({
          products: {
            clickCount: 1,
            lastClickedAt: '2026-05-27T21:00:00.000Z',
          },
        }),
      setItem: () => {
        throw new Error('storage full');
      },
    };

    const usage = recordSmartNavUsage(adapter, key, 'products', {
      now: new Date('2026-05-28T21:00:00.000Z'),
    });

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(usage).toMatchObject({
      products: {
        clickCount: 2,
        lastClickedAt: '2026-05-28T21:00:00.000Z',
      },
    });

    warnSpy.mockRestore();
  });
});
