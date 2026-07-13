import {
  matchesPetrockModelScope,
  normalizePetrockDeviceModel,
  type PetrockModelScope,
} from './petrock-device-model';
import { normalizePetrockRemediationCarrier } from './petrock-remediation-product-parser';

interface EligibilityResult {
  blacklistStatus?: string;
  carrier?: string;
  device?: string;
  financeStatus?: string;
  generation?: string;
  simLock?: string;
}

interface EligibilityProduct {
  carrier: string;
  id: string;
  isActive?: boolean;
  manualDisabled: boolean;
  modelScope: PetrockModelScope;
  statusSegment: string;
}

export type PetrockEligibilityCheckKind =
  | 'carrier_detection'
  | 'blacklist'
  | 'carrier_status';

function normalized(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function blacklistState(value: string | undefined) {
  const status = normalized(value);
  if (!status || status === 'unknown') return 'unknown';
  const riskTerms = status.replace(/not blacklisted|not reported/g, '');
  if (/blacklist|blocked|reported|stolen|lost/.test(riskTerms)) return 'risk';
  if (/not blacklisted|not reported|\bclean\b|\bclear\b/.test(status)) {
    return 'clean';
  }
  return 'unknown';
}

function simLockState(value: string | undefined) {
  const status = normalized(value);
  if (!status || status === 'unknown') return 'unknown';
  if (/unlocked|not locked/.test(status)) return 'unlocked';
  return /locked/.test(status) ? 'locked' : 'unknown';
}

function statusSegment(value: string | undefined) {
  const status = normalized(value);
  if (!status || status === 'unknown') return null;
  if (/blacklist|lost|stolen|blocked|unpaid/.test(status)) return 'risk';
  if (/past due/.test(status)) return 'past_due';
  if (/account[- ]?locked/.test(status)) return 'account_locked';
  if (/wait\s*30/.test(status)) return 'wait_30_days';
  if (/not active/.test(status)) return 'not_active';
  if (/clean|eligible|paid|clear/.test(status)) return 'clean';
  return null;
}

export function getPetrockEligibilityRequiredChecks(
  result: EligibilityResult
): PetrockEligibilityCheckKind[] {
  const checks: PetrockEligibilityCheckKind[] = [];
  if (
    !normalizePetrockRemediationCarrier(result.carrier ?? '') ||
    simLockState(result.simLock) === 'unknown'
  ) {
    checks.push('carrier_detection');
  }
  if (blacklistState(result.blacklistStatus) === 'unknown') {
    checks.push('blacklist');
  }
  if (!statusSegment(result.financeStatus)) checks.push('carrier_status');
  return checks;
}

export function evaluatePetrockRemediationEligibility({
  products,
  result,
}: {
  products: readonly EligibilityProduct[];
  result: EligibilityResult;
}) {
  const carrier = normalizePetrockRemediationCarrier(result.carrier ?? '');
  const blacklist = blacklistState(result.blacklistStatus);
  const finance = statusSegment(result.financeStatus);
  const checks = getPetrockEligibilityRequiredChecks(result);
  if (checks.length > 0) {
    return { checks, kind: 'checks_required' as const };
  }

  if (blacklist === 'risk') {
    return { kind: 'suppressed' as const, reason: 'blacklist_risk' as const };
  }
  if (finance === 'risk') {
    return {
      kind: 'suppressed' as const,
      reason: 'carrier_status_risk' as const,
    };
  }
  if (simLockState(result.simLock) !== 'locked') {
    return {
      kind: 'suppressed' as const,
      reason: 'not_carrier_locked' as const,
    };
  }

  const model = normalizePetrockDeviceModel(
    result.device ?? '',
    result.generation
  );
  const productIds = products
    .filter(
      (product) =>
        product.carrier === carrier &&
        product.statusSegment === finance &&
        product.isActive !== false &&
        !product.manualDisabled &&
        matchesPetrockModelScope(model, product.modelScope)
    )
    .map((product) => product.id);
  return productIds.length > 0
    ? { kind: 'eligible' as const, productIds }
    : {
        kind: 'suppressed' as const,
        reason: 'no_matching_product' as const,
      };
}
