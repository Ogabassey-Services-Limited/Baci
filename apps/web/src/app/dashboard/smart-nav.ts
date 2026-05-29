const SMART_NAV_STORAGE_PREFIX = 'baci.dashboard.smartNav';
const DEFAULT_MAX_SMART_SHORTCUTS = 4;
const URGENT_ITEM_SCORE = 1000;
const CLICK_SCORE = 10;
const RECENCY_WINDOW_DAYS = 30;
const EXCLUDED_SMART_ITEM_IDS = new Set(['dashboard']);

export type SmartNavUsageEntry = {
  clickCount: number;
  lastClickedAt: string;
};

export type SmartNavUsage = Record<string, SmartNavUsageEntry>;

export type SmartNavStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type SmartNavItem = {
  id: string;
};

export function buildSmartNavStorageKey(merchantId: string): string {
  return `${SMART_NAV_STORAGE_PREFIX}.${merchantId}`;
}

export function readSmartNavUsage(
  storage: SmartNavStorage,
  key: string
): SmartNavUsage {
  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) {
      return {};
    }

    const parsed: unknown = JSON.parse(rawValue);
    if (!isSmartNavUsage(parsed)) {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

export function recordSmartNavUsage(
  storage: SmartNavStorage,
  key: string,
  itemId: string,
  options: { now?: Date } = {}
): SmartNavUsage {
  const usage = readSmartNavUsage(storage, key);
  const currentEntry = usage[itemId];
  const nextUsage = {
    ...usage,
    [itemId]: {
      clickCount: (currentEntry?.clickCount ?? 0) + 1,
      lastClickedAt: (options.now ?? new Date()).toISOString(),
    },
  };

  try {
    storage.setItem(key, JSON.stringify(nextUsage));
  } catch (error) {
    console.warn('Dashboard smart navigation usage could not be persisted.', {
      error,
      key,
    });
  }

  return nextUsage;
}

export function getSmartShortcutItems<TItem extends SmartNavItem>({
  items,
  usage,
  urgentItemIds = [],
  maxItems = DEFAULT_MAX_SMART_SHORTCUTS,
  now = new Date(),
}: {
  items: TItem[];
  usage: SmartNavUsage;
  urgentItemIds?: string[];
  maxItems?: number;
  now?: Date;
}): TItem[] {
  const urgentIds = new Set(urgentItemIds);

  return items
    .map((item, index) => ({
      item,
      index,
      score: getSmartNavScore({
        entry: usage[item.id],
        isUrgent: urgentIds.has(item.id),
        itemId: item.id,
        now,
      }),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, maxItems)
    .map(({ item }) => item);
}

function getSmartNavScore({
  entry,
  isUrgent,
  itemId,
  now,
}: {
  entry?: SmartNavUsageEntry;
  isUrgent: boolean;
  itemId: string;
  now: Date;
}): number {
  if (EXCLUDED_SMART_ITEM_IDS.has(itemId)) {
    return 0;
  }

  if (!entry && !isUrgent) {
    return 0;
  }

  const clickScore = (entry?.clickCount ?? 0) * CLICK_SCORE;
  const recencyScore = entry ? getRecencyScore(entry.lastClickedAt, now) : 0;
  const urgentScore = isUrgent ? URGENT_ITEM_SCORE : 0;

  return urgentScore + clickScore + recencyScore;
}

function getRecencyScore(lastClickedAt: string, now: Date): number {
  const clickedAt = new Date(lastClickedAt).getTime();
  if (!Number.isFinite(clickedAt)) {
    return 0;
  }

  const ageMs = Math.max(0, now.getTime() - clickedAt);
  const ageDays = ageMs / 86_400_000;
  return Math.max(0, RECENCY_WINDOW_DAYS - ageDays);
}

function isSmartNavUsage(value: unknown): value is SmartNavUsage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(isSmartNavUsageEntry);
}

function isSmartNavUsageEntry(value: unknown): value is SmartNavUsageEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const entry = value as Partial<SmartNavUsageEntry>;
  return (
    typeof entry.clickCount === 'number' &&
    Number.isFinite(entry.clickCount) &&
    entry.clickCount >= 0 &&
    typeof entry.lastClickedAt === 'string'
  );
}
