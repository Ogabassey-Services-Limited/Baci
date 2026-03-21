import { type NextRequest, NextResponse } from 'next/server';
import { getDeviceImage } from '@/lib/device-images';

const SICKW_API_URL = 'https://sickw.com/api.php';
const SICKW_API_KEY = process.env.SICKW_API_KEY;

// Only warn if the key is NOT in the environment variables
if (!SICKW_API_KEY) {
  console.warn(
    '⚠️ WARNING: SICKW_API_KEY is missing. IMEI check service will be unavailable.'
  );
}

// Service tiers with pricing (cost to us, we can markup for profit)
const IMEI_SERVICE_TIERS = {
  basic: {
    id: '1',
    name: 'Basic Check',
    description: 'Device model identification',
    price: 100, // ₦100 to customer
    cost: 0.02, // $0.02 API cost
    features: ['Device Model', 'Model Number'],
    checksIncluded: ['device', 'modelNumber'],
  },
  blacklist: {
    id: '2',
    name: 'Blacklist Check',
    description: 'Is this phone reported stolen?',
    price: 300, // ₦300 to customer
    cost: 0.04, // $0.04 API cost
    features: ['Device Model', 'Blacklist Status', 'GSMA Database'],
    checksIncluded: ['device', 'modelNumber', 'blacklistStatus'],
  },
  carrier: {
    id: '25',
    name: 'Carrier Check',
    description: 'Network lock & carrier info',
    price: 500, // ₦500 to customer
    cost: 0.05, // $0.05 API cost
    features: ['Device Model', 'Original Carrier', 'SIM Lock Status'],
    checksIncluded: ['device', 'modelNumber', 'carrier', 'simLock'],
  },
  icloud: {
    id: '4',
    name: 'iCloud Check',
    description: 'Find My iPhone status',
    price: 800, // ₦800 to customer
    cost: 0.08, // $0.08 API cost
    features: ['Device Model', 'iCloud Lock', 'Find My iPhone'],
    checksIncluded: ['device', 'modelNumber', 'icloud'],
  },
  full: {
    id: '61',
    name: 'Full Verification',
    description: 'Complete device health report',
    price: 1500, // ₦1,500 to customer
    cost: 0.1, // $0.10 API cost
    features: [
      'Device Model',
      'iCloud Status',
      'Blacklist Check',
      'Carrier Info',
      'SIM Lock',
      'Trust Score',
    ],
    checksIncluded: [
      'device',
      'modelNumber',
      'icloud',
      'blacklistStatus',
      'carrier',
      'simLock',
    ],
    recommended: true,
  },
} as const;

export type ServiceTier = keyof typeof IMEI_SERVICE_TIERS;

interface ImeiCheckResult {
  imei: string;
  device: string;
  modelNumber: string;
  status: 'Clean' | 'Blacklisted' | 'Unknown';
  icloud: string;
  icloudLock: string;
  simLock: string;
  blacklistStatus: string;
  carrier: string;
  deviceImage: string;
  score: number;
  // New fields
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCountry?: string;
  warranty?: string;
  refurbished?: string;
  demoUnit?: string;
  deviceType: 'apple' | 'android' | 'other';
  verdict: string;
  verdictType: 'safe' | 'caution' | 'danger';
  rawResponse?: string;
}

/**
 * Strip HTML tags from a string using a safe character-by-character approach.
 * This handles recursive attacks like <scr<script>ipt> by removing ALL < and > chars
 * and any content between them, iteratively until stable.
 */
function stripHtml(html: string): string {
  if (!html) return '';

  // First, decode common HTML entities that could hide tags
  const decoded = html
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#60;/g, '<')
    .replace(/&#62;/g, '>')
    .replace(/&#x3c;/gi, '<')
    .replace(/&#x3e;/gi, '>');

  let current = decoded;
  let previous = '';
  let loops = 0;
  const maxLoops = 10; // Prevent infinite loops

  // Iteratively remove anything between < and > until stable
  while (current !== previous && loops < maxLoops) {
    previous = current;
    // Remove complete tags
    current = current.replace(/<[^<>]*>/g, '');
    // Also remove any orphan < or > to prevent partial tag injection
    loops++;
  }

  // Final cleanup: remove any remaining < or > characters entirely
  // This ensures no partial tags like "<script" can remain
  current = current.replace(/[<>]/g, '');

  return current.trim();
}

/**
 * Parse SICKW API response into structured data
 * Handles both plain text (legacy) and object/JSON responses
 */
function parseSickwResponse(
  input: string | Record<string, unknown>
): Partial<ImeiCheckResult> {
  const data: Record<string, string> = {};

  if (typeof input === 'object' && input !== null) {
    // If it's already an object, normalize keys to lowercase and strip HTML
    Object.keys(input).forEach((key) => {
      data[key.toLowerCase()] = stripHtml(String(input[key]));
    });
  } else if (typeof input === 'string') {
    // Parse text response format
    // Replace <br> tags with newlines if present (HTML response)
    const normalizedText = input.replace(/<br\s*\/?>/gi, '\n');

    const lines = normalizedText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        // Strip HTML from values (e.g., <font color="red">ON</font> -> ON)
        const value = stripHtml(line.substring(colonIndex + 1).trim());
        data[key] = value;
      }
    }
  }

  // Extract relevant fields - keys vary based on API response format
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

  // New fields
  const serialNumber = data['serial number'] || '';
  const purchaseDate = data['estimated purchase date'] || '';
  const purchaseCountry = data['purchase country'] || '';
  const warranty = data['warranty status'] || '';
  const refurbished = data['refurbished device'] || '';
  const demoUnit = data['demo unit'] || '';

  // Detect device type based on device name
  const deviceLower = device.toLowerCase();
  let deviceType: 'apple' | 'android' | 'other' = 'other';
  if (
    deviceLower.includes('iphone') ||
    deviceLower.includes('ipad') ||
    deviceLower.includes('apple') ||
    deviceLower.includes('mac')
  ) {
    deviceType = 'apple';
  } else if (
    deviceLower.includes('samsung') ||
    deviceLower.includes('pixel') ||
    deviceLower.includes('xiaomi') ||
    deviceLower.includes('oppo') ||
    deviceLower.includes('android')
  ) {
    deviceType = 'android';
  }

  // Determine status based on various factors
  const isBlacklisted =
    blacklist.toLowerCase().includes('blacklisted') ||
    blacklist.toLowerCase().includes('reported') ||
    blacklist.toLowerCase().includes('stolen') ||
    blacklist.toLowerCase().includes('lost');

  const hasIcloudLockOn =
    icloudLock.toLowerCase() === 'on' ||
    icloudLock.toLowerCase().includes('locked');

  const hasIcloudStatusIssue =
    icloudStatus.toLowerCase().includes('lost') ||
    icloudStatus.toLowerCase().includes('locked');

  const isSimLocked = simLock.toLowerCase().includes('locked');

  // Calculate trust score
  let score = 100;
  if (isBlacklisted) score -= 50;
  if (hasIcloudLockOn) score -= 30;
  if (hasIcloudStatusIssue) score -= 20;
  if (isSimLocked) score -= 10;
  if (!device) score -= 10;

  // Determine overall status
  let status: 'Clean' | 'Blacklisted' | 'Unknown' = 'Clean';
  if (!device && !blacklist && !icloudStatus && !icloudLock) {
    status = 'Unknown';
  } else if (isBlacklisted || hasIcloudStatusIssue) {
    status = 'Blacklisted';
  }

  // Generate verdict
  let verdict: string;
  let verdictType: 'safe' | 'caution' | 'danger';

  if (isBlacklisted) {
    verdict =
      '🚫 DO NOT BUY - This device is reported stolen/lost and may be blacklisted. You could lose your money and face legal issues.';
    verdictType = 'danger';
  } else if (hasIcloudLockOn) {
    verdict =
      "⚠️ CAUTION - Find My iPhone is ON. You cannot reset this device without the owner's Apple ID. Ensure seller disables it before purchase.";
    verdictType = 'caution';
  } else if (isSimLocked) {
    verdict =
      '⚠️ CAUTION - Device is carrier-locked. Check if it works with your network before buying.';
    verdictType = 'caution';
  } else if (status === 'Clean') {
    verdict =
      '✅ SAFE TO BUY - Device appears clean with no major issues. Always verify physically before payment.';
    verdictType = 'safe';
  } else {
    verdict =
      '❓ INCOMPLETE DATA - Could not verify all device information. Proceed with caution.';
    verdictType = 'caution';
  }

  return {
    device,
    modelNumber,
    status,
    icloud: icloudStatus || 'Unknown',
    icloudLock: icloudLock || 'Unknown',
    blacklistStatus: blacklist || 'Unknown',
    carrier: carrier || 'Unknown',
    simLock: simLock || 'Unknown',
    serialNumber: serialNumber || undefined,
    purchaseDate: purchaseDate || undefined,
    purchaseCountry: purchaseCountry || undefined,
    warranty: warranty || undefined,
    refurbished: refurbished || undefined,
    demoUnit: demoUnit || undefined,
    deviceType,
    score: Math.max(0, score),
    verdict,
    verdictType,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imei, tier = 'full' } = body;

    // Validate IMEI
    if (!imei || typeof imei !== 'string') {
      return NextResponse.json(
        { success: false, error: 'IMEI is required' },
        { status: 400 }
      );
    }

    const cleanImei = imei.replace(/\D/g, '');
    if (cleanImei.length !== 15) {
      return NextResponse.json(
        { success: false, error: 'IMEI must be 15 digits' },
        { status: 400 }
      );
    }

    // Luhn checksum validation for IMEI
    const luhnCheck = (imeiStr: string): boolean => {
      let sum = 0;
      for (let i = 0; i < imeiStr.length; i++) {
        let digit = Number.parseInt(imeiStr[i], 10);
        // Double every second digit (from right, so odd indices from left for 15 digits)
        if (i % 2 === 1) {
          digit *= 2;
          if (digit > 9) {
            digit = Math.floor(digit / 10) + (digit % 10);
          }
        }
        sum += digit;
      }
      return sum % 10 === 0;
    };

    if (!luhnCheck(cleanImei)) {
      return NextResponse.json(
        { success: false, error: 'Invalid IMEI checksum' },
        { status: 400 }
      );
    }

    // Validate service tier
    const serviceTier = IMEI_SERVICE_TIERS[tier as ServiceTier];
    if (!serviceTier) {
      return NextResponse.json(
        { success: false, error: 'Invalid service tier' },
        { status: 400 }
      );
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

    // Build SICKW API URL with selected service
    const apiUrl = `${SICKW_API_URL}?format=json&key=${SICKW_API_KEY}&imei=${cleanImei}&service=${serviceTier.id}`;

    console.log(
      `[IMEI Stick] Requesting SICKW API for tier: ${serviceTier.name} (${serviceTier.id})`
    );

    // Call SICKW API
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Baci-IMEI-Checker/1.0',
      },
    });

    if (!response.ok) {
      console.error(
        '[IMEI Check] SICKW API error:',
        response.status,
        response.statusText
      );
      return NextResponse.json(
        { success: false, error: 'IMEI check service unavailable' },
        { status: 503 }
      );
    }

    const rawText = await response.text();
    console.log('[IMEI Check] Raw SICKW Response:', rawText);

    // biome-ignore lint/suspicious/noExplicitAny: API structure is variable
    let apiResponse: any;
    try {
      apiResponse = JSON.parse(rawText);
    } catch {
      // Not JSON, likely plain text or HTML
      console.warn(
        '[IMEI Check] Response is not JSON, treating as text',
        rawText
      );
      apiResponse = { result: rawText };
    }

    // Check for API errors
    // SICKW uses "status": "error" OR sometimes just returns "Error: ..." string in result
    const isErrorObject =
      apiResponse.status === 'error' || Boolean(apiResponse.error);
    const isErrorString =
      typeof apiResponse.result === 'string' &&
      apiResponse.result.toLowerCase().startsWith('error');

    if (isErrorObject || isErrorString) {
      const errorMsg =
        apiResponse.message ||
        apiResponse.error ||
        apiResponse.result ||
        'Check failed';
      console.error('[IMEI Check] SICKW API returned error:', errorMsg);

      // Handle specific errors
      if (errorMsg.toLowerCase().includes('balance')) {
        return NextResponse.json(
          { success: false, error: 'Service temporarily unavailable' },
          { status: 503 }
        );
      }
      if (errorMsg.toLowerCase().includes('invalid')) {
        return NextResponse.json(
          { success: false, error: 'Invalid IMEI number' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: `Unable to verify: ${errorMsg.replace(/^error:\s*/i, '')}`,
        },
        { status: 400 }
      );
    }

    // Parse the response
    const resultText = apiResponse.result || apiResponse.data || apiResponse;
    const parsed = parseSickwResponse(resultText);

    // Get device image
    const device = parsed.device || '';
    const deviceImage = getDeviceImage(device);

    console.log('[IMEI Check] Parsed Data:', {
      device,
      status: parsed.status,
      score: parsed.score,
    });

    const result: ImeiCheckResult = {
      imei: cleanImei,
      device: device || 'Unknown Device',
      modelNumber: parsed.modelNumber || '',
      status: parsed.status || 'Unknown',
      icloud: parsed.icloud || 'Unknown',
      icloudLock: parsed.icloudLock || 'Unknown',
      simLock: parsed.simLock || 'Unknown',
      blacklistStatus: parsed.blacklistStatus || 'Unknown',
      carrier: parsed.carrier || 'Unknown',
      deviceImage,
      score: parsed.score || 50,
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
          ? JSON.stringify(apiResponse)
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
