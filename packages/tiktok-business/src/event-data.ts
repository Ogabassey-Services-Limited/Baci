export interface TikTokEventData {
  key: string;
  value: string | number | boolean;
}

export function normalizeTikTokEventData(
  eventData?: TikTokEventData[] | null
): Array<{ key: string; value: string }> | null {
  if (!eventData || eventData.length === 0) {
    return null;
  }

  const normalized = eventData
    .filter(({ key }) => key.trim().length > 0)
    .map(({ key, value }) => ({
      key: key.trim(),
      value: String(value),
    }));

  return normalized.length > 0 ? normalized : null;
}
