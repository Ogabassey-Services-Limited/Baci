import { canonicalJsonValue } from './canonical-json-value';

export function canonicalReplayEffectJson(value: unknown): string {
  return canonicalJsonValue(value);
}
