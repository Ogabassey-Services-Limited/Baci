const MI_LOCK_KEYS = [
  'mi lock',
  'mi lock status',
  'mi account',
  'mi account lock',
  'mi account status',
  'xiaomi lock',
  'xiaomi lock status',
] as const;

const MI_LOST_KEYS = [
  'mi lost',
  'mi lost status',
  'mi lost mode',
  'xiaomi lost',
  'xiaomi lost status',
] as const;

const GENERIC_LOST_KEYS = [
  'clean/lost',
  'clean lost',
  'clean lost status',
  'lost mode',
  'lost status',
] as const;

export function getXiaomiStatuses(
  data: Record<string, string>,
  device = ''
): {
  miLockStatus: string;
  miLostStatus: string;
} {
  const miLockStatus = getProviderField(data, MI_LOCK_KEYS);
  const miLostStatus = getProviderField(data, MI_LOST_KEYS);
  if (miLostStatus) {
    return { miLockStatus, miLostStatus };
  }

  const genericLostStatus = isXiaomiContext(data, device)
    ? getProviderField(data, GENERIC_LOST_KEYS)
    : '';

  return {
    miLockStatus,
    miLostStatus: genericLostStatus,
  };
}

export function hasXiaomiLockIssue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    Boolean(normalized) &&
    !hasAny(normalized, ['unlocked', 'off', 'clean', 'not locked']) &&
    (hasAny(normalized, ['locked', 'enabled', 'active']) || normalized === 'on')
  );
}

export function hasXiaomiLostIssue(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    Boolean(normalized) &&
    !hasAny(normalized, ['clean', 'not lost', 'no lost', 'off']) &&
    hasAny(normalized, ['lost', 'stolen', 'reported', 'blacklisted'])
  );
}

function getProviderField(
  data: Record<string, string>,
  keys: readonly string[]
): string {
  for (const key of keys) {
    if (data[key]) {
      return data[key];
    }
  }

  return '';
}

function isXiaomiContext(
  data: Record<string, string>,
  device: string
): boolean {
  const normalizedDevice = device.toLowerCase();
  return (
    ['xiaomi', 'redmi', 'poco'].some((brand) =>
      normalizedDevice.includes(brand)
    ) ||
    getProviderField(data, MI_LOCK_KEYS) !== '' ||
    getProviderField(data, MI_LOST_KEYS) !== ''
  );
}

function hasAny(value: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => value.includes(token));
}
