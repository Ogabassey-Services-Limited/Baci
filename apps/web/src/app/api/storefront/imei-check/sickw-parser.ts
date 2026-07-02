import { stripHtmlTags } from '@/lib/sanitize-core';
import type { ImeiCheckResult } from './sickw-parser.types';
import {
  buildVerdict,
  getProviderField,
  hasBlacklistIssue,
  hasRiskToken,
  inferDeviceType,
} from './sickw-parser-helpers';
import {
  getXiaomiStatuses,
  hasXiaomiLockIssue,
  hasXiaomiLostIssue,
} from './sickw-xiaomi-status';

type ProviderInput = string | Record<string, unknown>;

const SCORE_PENALTIES = {
  BLACKLIST: 50,
  ICLOUD_LOCK: 30,
  ICLOUD_STATUS: 20,
  KNOX_GUARD: 30,
  MDM_LOCK: 30,
  MI_LOCK: 30,
  MI_LOST: 50,
  MISSING_DEVICE: 10,
  SIM_LOCK: 10,
} as const;

const ICLOUD_STATUS_KEYS = [
  'icloud status',
  'icloud',
  'icloud clean/lost',
  'icloud clean/lost status',
  'icloud clean lost',
  'icloud clean lost status',
  'clean/lost',
  'clean/lost status',
  'clean lost',
  'clean lost status',
] as const;

function sanitizeProviderValue(value: unknown): string {
  if (value == null) return '';

  const decoded = String(value)
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#60;/g, '<')
    .replace(/&#62;/g, '>')
    .replace(/&#x3c;/gi, '<')
    .replace(/&#x3e;/gi, '>');

  return stripHtmlTags(decoded).replace(/[<>]/g, '').trim();
}

export function parseSickwResponse(
  input: ProviderInput
): Partial<ImeiCheckResult> {
  const data: Record<string, string> = {};

  if (typeof input === 'object' && input !== null) {
    Object.keys(input).forEach((key) => {
      data[key.toLowerCase()] = sanitizeProviderValue(input[key]);
    });
  } else if (typeof input === 'string') {
    const normalizedText = input.replace(/<br\s*\/?>/gi, '\n');
    const lines = normalizedText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = sanitizeProviderValue(line.substring(colonIndex + 1));
        data[key] = value;
      }
    }
  }

  const modelNumber =
    data['model number'] || data['model no'] || data.mpn || '';
  const device =
    data['model description'] ||
    data.model ||
    data.device ||
    data['model name'] ||
    data['device name'] ||
    '';
  const icloudStatus = getProviderField(data, ICLOUD_STATUS_KEYS);
  const icloudLock =
    data['icloud lock'] || data['find my iphone'] || data.fmi || '';
  const blacklist =
    data['blacklist status'] || data.blacklist || data['gsma blacklist'] || '';
  const carrier =
    data['locked carrier'] ||
    data.carrier ||
    data.network ||
    data['sim carrier'] ||
    '';
  const simLock =
    data['sim-lock status'] ||
    data['sim lock'] ||
    data.simlock ||
    data['sim lock status'] ||
    '';
  const activationStatus = data['activation status'] || '';
  const serialNumber = data['serial number'] || '';
  const purchaseDate = data['estimated purchase date'] || '';
  const purchaseCountry = data['purchase country'] || '';
  const warranty = data['warranty status'] || '';
  const refurbished = data['refurbished device'] || '';
  const demoUnit = data['demo unit'] || '';
  const mdmStatus =
    data['mdm status'] ||
    data['mobile device management'] ||
    data['mdm lock status'] ||
    data['management lock'] ||
    '';
  const knoxGuardStatus =
    data['knox guard'] ||
    data['knox guard status'] ||
    data.knoxguard ||
    data['kg status'] ||
    '';
  const partNumber = data['part number'] || data['part no'] || '';
  const repairEligibility =
    data['repair eligibility'] ||
    data['gsx repair eligibility'] ||
    data['service eligibility'] ||
    '';
  const gsxCoverage =
    data.coverage ||
    data['warranty coverage'] ||
    data['coverage status'] ||
    data.applecare ||
    '';
  const repairHistory =
    data['repair history'] || data.repairs || data.cases || '';
  const replacementHistory =
    data['replacement status'] ||
    data.replacement ||
    data.replaced ||
    data['replacement history'] ||
    '';
  const { miLockStatus, miLostStatus } = getXiaomiStatuses(data, device);

  const deviceType = inferDeviceType(device);
  const isBlacklisted = hasBlacklistIssue(blacklist);
  const hasIcloudLockOn = hasRiskToken(icloudLock, ['on', 'locked', 'lost']);
  const hasIcloudStatusIssue = hasRiskToken(icloudStatus, ['lost', 'locked']);
  const isSimLocked = hasRiskToken(simLock, ['locked']);
  const hasMdmIssue = hasRiskToken(mdmStatus, [
    'active',
    'enabled',
    'locked',
    'on',
  ]);
  const hasKnoxGuardIssue = hasRiskToken(knoxGuardStatus, [
    'active',
    'enabled',
    'locked',
    'on',
  ]);
  const hasMiLockIssue = hasXiaomiLockIssue(miLockStatus);
  const hasMiLostIssue = hasXiaomiLostIssue(miLostStatus);

  let score = 100;
  if (isBlacklisted) score -= SCORE_PENALTIES.BLACKLIST;
  if (hasMiLostIssue) score -= SCORE_PENALTIES.MI_LOST;
  if (hasIcloudLockOn) score -= SCORE_PENALTIES.ICLOUD_LOCK;
  if (hasMdmIssue) score -= SCORE_PENALTIES.MDM_LOCK;
  if (hasKnoxGuardIssue) score -= SCORE_PENALTIES.KNOX_GUARD;
  if (hasMiLockIssue) score -= SCORE_PENALTIES.MI_LOCK;
  if (hasIcloudStatusIssue) score -= SCORE_PENALTIES.ICLOUD_STATUS;
  if (isSimLocked) score -= SCORE_PENALTIES.SIM_LOCK;
  if (!device) score -= SCORE_PENALTIES.MISSING_DEVICE;

  let status: 'Clean' | 'Blacklisted' | 'Unknown' = 'Clean';
  if (!device && !blacklist && !icloudStatus && !icloudLock) {
    status = 'Unknown';
  } else if (isBlacklisted || hasIcloudStatusIssue || hasMiLostIssue) {
    status = 'Blacklisted';
  }

  const verdict = buildVerdict({
    hasIcloudLockOn,
    hasIcloudStatusIssue,
    hasKnoxGuardIssue,
    hasMdmIssue,
    hasMiLockIssue,
    hasMiLostIssue,
    isBlacklisted,
    isSimLocked,
    status,
  });

  return {
    device,
    modelNumber,
    status,
    icloud: icloudStatus || 'Unknown',
    icloudLock: icloudLock || 'Unknown',
    blacklistStatus: blacklist || 'Unknown',
    carrier: carrier || 'Unknown',
    simLock: simLock || 'Unknown',
    ...(activationStatus && { activationStatus }),
    ...(serialNumber && { serialNumber }),
    ...(purchaseDate && { purchaseDate }),
    ...(purchaseCountry && { purchaseCountry }),
    ...(warranty && { warranty }),
    ...(refurbished && { refurbished }),
    ...(demoUnit && { demoUnit }),
    ...(mdmStatus && { mdmStatus }),
    ...(knoxGuardStatus && { knoxGuardStatus }),
    ...(miLockStatus && { miLockStatus }),
    ...(miLostStatus && { miLostStatus }),
    ...(partNumber && { partNumber }),
    ...(repairEligibility && { repairEligibility }),
    ...(gsxCoverage && { gsxCoverage }),
    ...(repairHistory && { repairHistory }),
    ...(replacementHistory && { replacementHistory }),
    deviceType,
    score: Math.max(0, score),
    verdict: verdict.text,
    verdictType: verdict.type,
  };
}
