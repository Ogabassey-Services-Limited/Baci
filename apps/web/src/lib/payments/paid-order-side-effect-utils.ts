export function toNumber(value: unknown, label: string) {
  if (value === null || value === undefined) {
    throw new Error(`Invalid ${label}: missing value`);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`Invalid ${label}: must be string or number`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(`Invalid ${label}: empty string`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  if (parsed < 0) {
    throw new Error(`Invalid ${label}: negative value`);
  }
  return parsed;
}
