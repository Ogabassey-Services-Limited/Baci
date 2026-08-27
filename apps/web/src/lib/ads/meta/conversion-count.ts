import { META_ADS_CONVERSION_ACTION_TYPES } from './constants';
import type { MetaAdsDailyInsight } from './provider-types';

function addExactDecimalStrings(values: string[]): string {
  const maxScale = values.reduce(
    (maximum, value) => Math.max(maximum, value.split('.')[1]?.length ?? 0),
    0
  );
  const total = values.reduce((sum, value) => {
    const [whole, fractional = ''] = value.split('.');
    return sum + BigInt(`${whole}${fractional.padEnd(maxScale, '0')}`);
  }, 0n);
  if (maxScale === 0) return total.toString();
  const padded = total.toString().padStart(maxScale + 1, '0');
  const whole = padded.slice(0, -maxScale);
  const fractional = padded.slice(-maxScale).replace(/0+$/, '');
  return fractional ? `${whole}.${fractional}` : whole;
}

export function countMetaAdsConversions(
  actions: MetaAdsDailyInsight['actions']
): string {
  return addExactDecimalStrings(
    actions
      .filter((action) =>
        META_ADS_CONVERSION_ACTION_TYPES.has(action.actionType)
      )
      .map((action) => action.value)
  );
}
