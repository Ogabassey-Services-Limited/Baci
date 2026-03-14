import { createLogger } from '@/lib/logger';

interface LegacyCartSelectionState {
  color?: string;
  selected_attributes?: Record<string, string>;
  storage?: string;
}
type PersistedCartState<T extends LegacyCartSelectionState> = Record<
  string,
  unknown
> & {
  items?: T[];
};
const log = createLogger('CartStorePersistence');

function normalizeLegacySelectionValue(
  value: string | undefined
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function getPersistedCartItems<T extends LegacyCartSelectionState>(
  items: T[] | undefined
): T[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(
    (item): item is T => item != null && typeof item === 'object'
  );
}

/**
 * Backfills normalized `selected_attributes` from deprecated top-level
 * `color` and `storage` fields on persisted cart items.
 *
 * This runs during cart persistence migration so older app installs still
 * match cart identity using the newer selected-attributes model.
 *
 * @template T - Cart item shape containing the legacy selection fields.
 * @param items - Persisted cart items from storage, or `undefined` when absent.
 * @returns The migrated cart items with legacy selection fields backfilled.
 */
export function migrateLegacyCartItems<T extends LegacyCartSelectionState>(
  items: T[] | undefined
): T[] {
  return getPersistedCartItems(items).map((item) => {
    const selectedAttributes = {
      ...(item.selected_attributes || {}),
    };
    const normalizedColor = normalizeLegacySelectionValue(item.color);
    const normalizedStorage = normalizeLegacySelectionValue(item.storage);

    if (normalizedColor && !selectedAttributes.color) {
      selectedAttributes.color = normalizedColor;
    }

    if (normalizedStorage && !selectedAttributes.storage) {
      selectedAttributes.storage = normalizedStorage;
    }

    return Object.keys(selectedAttributes).length > 0
      ? { ...item, selected_attributes: selectedAttributes }
      : item;
  });
}

/**
 * Migrates persisted cart state into the current app format.
 *
 * Older storage versions backfill `selected_attributes` from legacy top-level
 * fields, while current or unknown versions preserve the existing state shape.
 *
 * @template T - Cart item shape containing the legacy selection fields.
 * @param persistedState - Persisted cart state from storage, or `undefined`
 * when no cart has been stored yet.
 * @param version - Zustand persist version for the stored payload. Versions `0`
 * and `1` trigger the legacy attribute backfill path; all other versions are
 * treated as current-state passthroughs after item sanitization.
 * @returns The migrated cart state, or the original state shape with sanitized
 * items when no legacy migration is required.
 */
export function migratePersistedCartState<T extends LegacyCartSelectionState>(
  persistedState: PersistedCartState<T> | undefined,
  version: number
): PersistedCartState<T> {
  try {
    switch (version) {
      case 0:
      case 1:
        return {
          ...persistedState,
          items: migrateLegacyCartItems(persistedState?.items),
        };
      default: {
        const items = getPersistedCartItems(persistedState?.items);

        return {
          ...persistedState,
          items,
        };
      }
    }
  } catch (error) {
    log.warn('migratePersistedCartState failed; falling back to empty items', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { ...persistedState, items: [] };
  }
}
