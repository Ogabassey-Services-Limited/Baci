import {
  IMEI_SERVICE_TIERS,
  type ImeiServiceTierKey,
  isImeiServiceTierKey,
} from '@baci/shared/imei';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRootDomain } from '@/env';
import { getDeviceImage } from '@/lib/device-images';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';
import { sickwClient } from './sickw-client';
import { parseSickwResponse } from './sickw-parser';
import type { ImeiCheckResult } from './sickw-parser.types';

// TODO(payment-gate): SICKW IMEI checks invoke a paid third-party API at up to
// $0.70/request. The long-term fix is to gate this endpoint behind either
// (a) a verified paid order from the buyer, OR
// (b) a merchant-funded credit pool with quota tracking.
// Until that flow ships, the storefront-origin + rate-limit gates below are
// the defensive baseline. Tracked in
// docs/superpowers/plans/2026-05-09-petrock-imei-integration.md.
//
// Native (mobile) clients post here without a CSRF cookie pair; rather than
// 403 every legitimate native call, we lean on the storefront-host origin
// gate + rate limit below. The wallet follow-up will add Bearer auth which
// renders CSRF moot for the same-origin browser flow (Bearer tokens aren't
// auto-attached cross-origin, so CSRF doesn't apply).
export async function POST(request: NextRequest) {
  try {
    // 1. Storefront origin gate — request must come from a recognized
    // merchant host (subdomain or custom domain). Arbitrary external POSTs
    // (Postman, curl, scrapers) cannot resolve a merchant and are rejected.
    const merchantResolution = await resolveStorefrontMerchantFromRequest({
      request,
      rootDomain: getRootDomain() || 'usebaci.com',
      notFoundError: 'IMEI check is only available on storefront hosts',
      lookupError: 'Failed to validate storefront host',
    });
    if (!merchantResolution.success) {
      return NextResponse.json(
        { success: false, error: merchantResolution.error },
        { status: merchantResolution.status }
      );
    }

    // 2. Per-IP rate limit using the shared trie config
    // (`/api/storefront/imei-check` -> 10/60s). Gives us defense-in-depth
    // independent of the proxy and a tight ceiling because each downstream
    // call costs real money.
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit.limit,
        rateLimit.remaining,
        rateLimit.resetTime
      );
    }

    const rawBody = await request.json();
    const bodyParse = z
      .object({ imei: z.string(), tier: z.string().optional() })
      .safeParse(rawBody);
    if (!bodyParse.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const imeiResult = parseImei(bodyParse.data);
    if (!imeiResult.ok) {
      return imeiResult.response;
    }

    const tierResult = parseTier(bodyParse.data);
    if (!tierResult.ok) {
      return tierResult.response;
    }

    const sickwApiKey = sickwClient.getApiKey();
    if (!sickwApiKey) {
      console.error(
        '[IMEI Check] SICKW_API_KEY is not configured. Cannot process request.'
      );
      return NextResponse.json(
        { success: false, error: 'Service configuration error' },
        { status: 503 }
      );
    }

    const serviceTier = IMEI_SERVICE_TIERS[tierResult.tier];
    const apiResponse = await sickwClient.requestCheck({
      apiKey: sickwApiKey,
      imei: imeiResult.imei,
      serviceId: serviceTier.providerServiceId,
    });

    if (!apiResponse.ok) {
      return apiResponse.response;
    }

    const resultText = sickwClient.normalizeResult(
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
      miLockStatus: parsed.miLockStatus,
      miLostStatus: parsed.miLostStatus,
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
