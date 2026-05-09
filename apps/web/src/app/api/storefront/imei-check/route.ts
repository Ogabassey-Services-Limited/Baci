import {
  IMEI_SERVICE_TIERS,
  type ImeiServiceTierKey,
  isImeiServiceTierKey,
} from '@baci/shared/imei';
import { type NextRequest, NextResponse } from 'next/server';
import { getDeviceImage } from '@/lib/device-images';
import { parseSickwResponse } from './sickw-parser';
import type { ImeiCheckResult } from './sickw-parser.types';

const SICKW_API_URL = 'https://sickw.com/api.php';
const SICKW_API_KEY = process.env.SICKW_API_KEY;

if (!SICKW_API_KEY) {
  console.warn(
    'WARNING: SICKW_API_KEY is missing. IMEI check service will be unavailable.'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imeiResult = parseImei(body);
    if (!imeiResult.ok) {
      return imeiResult.response;
    }

    const tierResult = parseTier(body);
    if (!tierResult.ok) {
      return tierResult.response;
    }

    if (!SICKW_API_KEY) {
      console.error(
        '[IMEI Check] SICKW_API_KEY is not configured. Cannot process request.'
      );
      return NextResponse.json(
        { success: false, error: 'Service configuration error' },
        { status: 503 }
      );
    }

    const serviceTier = IMEI_SERVICE_TIERS[tierResult.tier];
    const apiResponse = await requestSickwCheck({
      imei: imeiResult.imei,
      serviceId: serviceTier.providerServiceId,
    });

    if (!apiResponse.ok) {
      return apiResponse.response;
    }

    const resultText = normalizeProviderResult(
      apiResponse.payload.result ??
        apiResponse.payload.data ??
        apiResponse.payload
    );
    const parsed = parseSickwResponse(resultText);
    const device = parsed.device || '';
    const result: ImeiCheckResult = {
      imei: imeiResult.imei,
      device: device || 'Unknown Device',
      modelNumber: parsed.modelNumber || '',
      status: parsed.status || 'Unknown',
      icloud: parsed.icloud || 'Unknown',
      icloudLock: parsed.icloudLock || 'Unknown',
      simLock: parsed.simLock || 'Unknown',
      blacklistStatus: parsed.blacklistStatus || 'Unknown',
      carrier: parsed.carrier || 'Unknown',
      deviceImage: getDeviceImage(device),
      score: parsed.score || 50,
      activationStatus: parsed.activationStatus,
      serialNumber: parsed.serialNumber,
      purchaseDate: parsed.purchaseDate,
      purchaseCountry: parsed.purchaseCountry,
      warranty: parsed.warranty,
      refurbished: parsed.refurbished,
      demoUnit: parsed.demoUnit,
      deviceType: parsed.deviceType || 'other',
      verdict: parsed.verdict || 'Unable to determine device status.',
      verdictType: parsed.verdictType || 'caution',
      rawResponse:
        process.env.NODE_ENV === 'development'
          ? JSON.stringify(apiResponse.payload)
          : undefined,
    };

    return NextResponse.json({
      success: true,
      data: result,
      tier: {
        name: serviceTier.name,
        checksIncluded: serviceTier.checksIncluded,
      },
    });
  } catch (error) {
    console.error('IMEI check error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function parseImei(
  body: unknown
): { ok: true; imei: string } | { ok: false; response: NextResponse } {
  const imei = getBodyValue(body, 'imei');
  if (typeof imei !== 'string') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'IMEI is required' },
        { status: 400 }
      ),
    };
  }

  const cleanImei = imei.replace(/\D/g, '');
  if (cleanImei.length !== 15) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'IMEI must be 15 digits' },
        { status: 400 }
      ),
    };
  }

  if (!isValidImeiChecksum(cleanImei)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Invalid IMEI checksum' },
        { status: 400 }
      ),
    };
  }

  return { ok: true, imei: cleanImei };
}

function parseTier(
  body: unknown
):
  | { ok: true; tier: ImeiServiceTierKey }
  | { ok: false; response: NextResponse } {
  const rawTier = getBodyValue(body, 'tier') ?? 'full';
  if (isImeiServiceTierKey(rawTier)) {
    return { ok: true, tier: rawTier };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: 'Invalid service tier' },
      { status: 400 }
    ),
  };
}

function getBodyValue(body: unknown, key: string): unknown {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  return (body as Record<string, unknown>)[key];
}

function isValidImeiChecksum(imei: string): boolean {
  let sum = 0;
  for (let i = 0; i < imei.length; i++) {
    let digit = Number.parseInt(imei[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

async function requestSickwCheck({
  imei,
  serviceId,
}: {
  imei: string;
  serviceId: string;
}): Promise<
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; response: NextResponse }
> {
  const apiUrl = `${SICKW_API_URL}?format=json&key=${SICKW_API_KEY}&imei=${imei}&service=${serviceId}`;
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: { 'User-Agent': 'Baci-IMEI-Checker/1.0' },
  });

  if (!response.ok) {
    console.error(
      '[IMEI Check] SICKW API error:',
      response.status,
      response.statusText
    );
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'IMEI check service unavailable' },
        { status: 503 }
      ),
    };
  }

  const rawText = await response.text();
  const payload = parseProviderPayload(rawText);
  const providerError = getProviderError(payload);
  if (providerError) {
    return {
      ok: false,
      response: providerErrorToResponse(providerError),
    };
  }

  return { ok: true, payload };
}

function parseProviderPayload(rawText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    console.warn('[IMEI Check] Response is not JSON, treating as text');
  }

  return { result: rawText };
}

function normalizeProviderResult(
  result: unknown
): string | Record<string, unknown> {
  if (typeof result === 'string') {
    return result;
  }

  if (result && typeof result === 'object') {
    return result as Record<string, unknown>;
  }

  return '';
}

function getProviderError(payload: Record<string, unknown>): string | null {
  const result = payload.result;
  const isErrorObject = payload.status === 'error' || Boolean(payload.error);
  const isErrorString =
    typeof result === 'string' && result.toLowerCase().startsWith('error');

  if (!isErrorObject && !isErrorString) {
    return null;
  }

  const errorValue = payload.message ?? payload.error ?? result;
  return typeof errorValue === 'string' ? errorValue : 'Check failed';
}

function providerErrorToResponse(errorMessage: string): NextResponse {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes('balance')) {
    return NextResponse.json(
      { success: false, error: 'Service temporarily unavailable' },
      { status: 503 }
    );
  }

  if (normalized.includes('invalid')) {
    return NextResponse.json(
      { success: false, error: 'Invalid IMEI number' },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: `Unable to verify: ${errorMessage.replace(/^error:\s*/i, '')}`,
    },
    { status: 400 }
  );
}
