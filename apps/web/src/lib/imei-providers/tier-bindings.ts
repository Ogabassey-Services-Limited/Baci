import 'server-only';

import type { ImeiServiceTierKey } from '@baci/shared/imei';
import type {
  ImeiProviderBinding,
  ResolveImeiProviderBindingInput,
} from './types';

const PETROCK_TIER_BINDINGS: Partial<
  Record<ImeiServiceTierKey, ImeiProviderBinding>
> = {
  blacklist: {
    costUsd: 0.019,
    deviceCategories: ['smartphone'],
    orderFieldName: 'IMEI',
    productId: '1955',
    provider: 'petrock',
  },
  knoxGuard: {
    costUsd: 0.06,
    deviceCategories: ['smartphone'],
    orderFieldName: 'IMEI/SN',
    productId: '699',
    provider: 'petrock',
  },
  pixel: {
    costUsd: 0.096,
    deviceCategories: ['smartphone'],
    orderFieldName: 'IMEI',
    productId: '721',
    provider: 'petrock',
  },
  samsung: {
    costUsd: 0.057,
    deviceCategories: ['smartphone'],
    orderFieldName: 'IMEI',
    productId: '741',
    provider: 'petrock',
  },
  simLock: {
    costUsd: 0.019,
    deviceCategories: ['smartphone'],
    orderFieldName: 'IMEI or Serial Number',
    productId: '693',
    provider: 'petrock',
  },
};

function sickwBinding({ tier }: ResolveImeiProviderBindingInput) {
  return {
    costUsd: tier.costUsd,
    deviceCategories: tier.deviceCategories,
    orderFieldName: 'imei',
    productId: tier.providerServiceId,
    provider: 'sickw',
  } satisfies ImeiProviderBinding;
}

export function resolveImeiProviderBinding(
  input: ResolveImeiProviderBindingInput
): ImeiProviderBinding | null {
  const petrockOnly = input.tier.providerServiceId === 'petrock-only';
  if (
    !input.petrockEnabled ||
    !input.clientSupportsAsync ||
    !input.petrockEnabledTiers.has(input.tierKey)
  ) {
    return petrockOnly ? null : sickwBinding(input);
  }

  const binding = PETROCK_TIER_BINDINGS[input.tierKey];
  if (!binding) {
    return petrockOnly ? null : sickwBinding(input);
  }

  if (
    (input.tier.deviceCategories.length > 1 && !input.deviceCategory) ||
    (input.deviceCategory &&
      !binding.deviceCategories.includes(input.deviceCategory))
  ) {
    return petrockOnly ? null : sickwBinding(input);
  }

  return binding;
}
