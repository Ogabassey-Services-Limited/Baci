import { type NextRequest, NextResponse } from 'next/server';
import { getDeviceImage } from '@/lib/device-images';

const SICKW_API_URL = 'https://sickw.com/api.php';
const SICKW_API_KEY =
  process.env.SICKW_API_KEY || 'DFR-BAS-8T4-TCX-IN9-RIP-X3M-7V2';

// Service tiers with pricing (cost to us, we can markup for profit)
export const IMEI_SERVICE_TIERS = {
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
  simLock: string;
  blacklistStatus: string;
  carrier: string;
  deviceImage: string;
  score: number;
  rawResponse?: string;
}

/**
 * Parse SICKW API text response into structured data
 *
 * Example response:
 * Model Number: A2849
 * Model: iPhone 15 Pro Max
 * iCloud Status: Clean
 * Blacklist Status: Clean
 * Carrier: AT&T
 * SIM Lock: Unlocked
 */
function parseSickwResponse(text: string): Partial<ImeiCheckResult> {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const data: Record<string, string> = {};

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      data[key] = value;
    }
  }

  // Extract relevant fields - keys vary based on API response format
  const modelNumber = data['model number'] || data['model no'] || '';
  const device =
    data.model ||
    data.device ||
    data['model name'] ||
    data['device name'] ||
    '';
  const icloud =
    data['icloud status'] ||
    data.icloud ||
    data['find my iphone'] ||
    data.fmi ||
    '';
  const blacklist =
    data['blacklist status'] || data.blacklist || data['gsma blacklist'] || '';
  const carrier = data.carrier || data.network || data['sim carrier'] || '';
  const simLock =
    data['sim lock'] ||
    data.simlock ||
    data['sim lock status'] ||
    data['lock status'] ||
    '';

  // Determine overall status
  const isBlacklisted =
    blacklist.toLowerCase().includes('blacklisted') ||
    blacklist.toLowerCase().includes('reported') ||
    blacklist.toLowerCase().includes('stolen') ||
    blacklist.toLowerCase().includes('lost');

  const hasIcloudIssue =
    icloud.toLowerCase().includes('on') ||
    icloud.toLowerCase().includes('lost') ||
    icloud.toLowerCase().includes('locked');

  let status: 'Clean' | 'Blacklisted' | 'Unknown' = 'Clean';
  if (isBlacklisted || hasIcloudIssue) {
    status = 'Blacklisted';
  }

  // Calculate trust score
  let score = 100;
  if (isBlacklisted) score -= 50;
  if (hasIcloudIssue) score -= 30;
  if (simLock.toLowerCase().includes('locked')) score -= 10;
  if (!device) score -= 10;

  return {
    device,
    modelNumber,
    status,
    icloud: icloud || 'Unknown',
    blacklistStatus: blacklist || 'Unknown',
    carrier: carrier || 'Unknown',
    simLock: simLock || 'Unknown',
    score: Math.max(0, score),
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

    // Validate service tier
    const serviceTier = IMEI_SERVICE_TIERS[tier as ServiceTier];
    if (!serviceTier) {
      return NextResponse.json(
        { success: false, error: 'Invalid service tier' },
        { status: 400 }
      );
    }

    // Build SICKW API URL with selected service
    const apiUrl = `${SICKW_API_URL}?format=json&key=${SICKW_API_KEY}&imei=${cleanImei}&service=${serviceTier.id}`;

    // Call SICKW API
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Baci-IMEI-Checker/1.0',
      },
    });

    if (!response.ok) {
      console.error('SICKW API error:', response.status, response.statusText);
      return NextResponse.json(
        { success: false, error: 'IMEI check service unavailable' },
        { status: 503 }
      );
    }

    const apiResponse = await response.json();

    // Check for API errors
    if (apiResponse.status === 'error' || apiResponse.error) {
      const errorMsg =
        apiResponse.message || apiResponse.error || 'Check failed';
      console.error('SICKW API returned error:', errorMsg);

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
        { success: false, error: 'Unable to verify this IMEI' },
        { status: 400 }
      );
    }

    // Parse the response
    const resultText = apiResponse.result || apiResponse.data || '';
    const parsed = parseSickwResponse(
      typeof resultText === 'string' ? resultText : JSON.stringify(resultText)
    );

    // Get device image
    const deviceImage = getDeviceImage(parsed.device || '');

    const result: ImeiCheckResult = {
      imei: cleanImei,
      device: parsed.device || 'Unknown Device',
      modelNumber: parsed.modelNumber || '',
      status: parsed.status || 'Unknown',
      icloud: parsed.icloud || 'Unknown',
      simLock: parsed.simLock || 'Unknown',
      blacklistStatus: parsed.blacklistStatus || 'Unknown',
      carrier: parsed.carrier || 'Unknown',
      deviceImage,
      score: parsed.score || 50,
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
