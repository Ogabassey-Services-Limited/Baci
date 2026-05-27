export interface TikTokEventData {
  key: string;
  value: string;
}

function serializeTikTokEventValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  return null;
}

export function toTikTokEventData(
  params: Record<string, unknown> = {}
): TikTokEventData[] {
  return Object.entries(params).flatMap(([key, value]) => {
    const serializedValue = serializeTikTokEventValue(value);
    return serializedValue === null ? [] : [{ key, value: serializedValue }];
  });
}
