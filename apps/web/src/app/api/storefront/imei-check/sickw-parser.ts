import { stripHtmlTags } from '@/lib/sanitize-core';
import type { ImeiCheckResult } from './sickw-parser.types';

type ProviderInput = string | Record<string, unknown>;

const VERDICT_MESSAGES = {
  blacklisted:
    'DO NOT BUY - This device is reported stolen/lost and may be blacklisted. You could lose your money and face legal issues.',
  clean:
    'SAFE TO BUY - Device appears clean with no major issues. Always verify physically before payment.',
  icloudLocked:
    "CAUTION - Find My iPhone is ON. You cannot reset this device without the owner's Apple ID. Ensure seller disables it before purchase.",
  incomplete:
    'INCOMPLETE DATA - Could not verify all device information. Proceed with caution.',
  simLocked:
    'CAUTION - Device is carrier-locked. Check if it works with your network before buying.',
} as const;

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
  const icloudStatus = data['icloud status'] || data.icloud || '';
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

  const deviceType = inferDeviceType(device);
  const isBlacklisted = hasBlacklistIssue(blacklist);
  const hasIcloudLockOn =
    icloudLock.toLowerCase() === 'on' ||
    icloudLock.toLowerCase().includes('locked');
  const hasIcloudStatusIssue =
    icloudStatus.toLowerCase().includes('lost') ||
    icloudStatus.toLowerCase().includes('locked');
  const isSimLocked = simLock.toLowerCase().includes('locked');

  let score = 100;
  if (isBlacklisted) score -= 50;
  if (hasIcloudLockOn) score -= 30;
  if (hasIcloudStatusIssue) score -= 20;
  if (isSimLocked) score -= 10;
  if (!device) score -= 10;

  let status: 'Clean' | 'Blacklisted' | 'Unknown' = 'Clean';
  if (!device && !blacklist && !icloudStatus && !icloudLock) {
    status = 'Unknown';
  } else if (isBlacklisted || hasIcloudStatusIssue) {
    status = 'Blacklisted';
  }

  const verdict = buildVerdict({
    hasIcloudLockOn,
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
    deviceType,
    score: Math.max(0, score),
    verdict: verdict.text,
    verdictType: verdict.type,
  };
}

function inferDeviceType(device: string): ImeiCheckResult['deviceType'] {
  const deviceLower = device.toLowerCase();
  if (
    deviceLower.includes('iphone') ||
    deviceLower.includes('ipad') ||
    deviceLower.includes('apple') ||
    deviceLower.includes('mac')
  ) {
    return 'apple';
  }

  if (
    deviceLower.includes('samsung') ||
    deviceLower.includes('pixel') ||
    deviceLower.includes('xiaomi') ||
    deviceLower.includes('oppo') ||
    deviceLower.includes('android')
  ) {
    return 'android';
  }

  return 'other';
}

function hasBlacklistIssue(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('blacklisted') ||
    normalized.includes('reported') ||
    normalized.includes('stolen') ||
    normalized.includes('lost')
  );
}

function buildVerdict({
  hasIcloudLockOn,
  isBlacklisted,
  isSimLocked,
  status,
}: {
  hasIcloudLockOn: boolean;
  isBlacklisted: boolean;
  isSimLocked: boolean;
  status: ImeiCheckResult['status'];
}): { text: string; type: ImeiCheckResult['verdictType'] } {
  if (isBlacklisted) {
    return {
      text: VERDICT_MESSAGES.blacklisted,
      type: 'danger',
    };
  }

  if (hasIcloudLockOn) {
    return {
      text: VERDICT_MESSAGES.icloudLocked,
      type: 'caution',
    };
  }

  if (isSimLocked) {
    return {
      text: VERDICT_MESSAGES.simLocked,
      type: 'caution',
    };
  }

  if (status === 'Clean') {
    return {
      text: VERDICT_MESSAGES.clean,
      type: 'safe',
    };
  }

  return {
    text: VERDICT_MESSAGES.incomplete,
    type: 'caution',
  };
}
