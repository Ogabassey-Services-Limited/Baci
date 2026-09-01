interface TimedEntry<T> {
  cachedAt: number;
  value: T;
}

/** Small per-instance LRU for short-lived, positive provider results. */
export class BoundedTtlCache<T> {
  private readonly entries = new Map<string, TimedEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = () => Date.now()
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (this.now() - entry.cachedAt >= this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
    this.entries.set(key, { cachedAt: this.now(), value });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  deleteWhere(predicate: (value: T) => boolean): void {
    for (const [key, entry] of this.entries) {
      if (predicate(entry.value)) this.entries.delete(key);
    }
  }
}
