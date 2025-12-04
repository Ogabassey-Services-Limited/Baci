import { NextResponse } from 'next/server';
import {
  detectNetworkProvider,
  getAirtimeDenominations,
  NetworkProvider,
} from '@/lib/kuda';

// GET /api/vtu/providers - Get available network providers and denominations
export function GET() {
  try {
    const providers = [
      {
        id: NetworkProvider.MTN,
        name: 'MTN',
        logo: '/images/networks/mtn.png',
        color: '#FFCC00',
      },
      {
        id: NetworkProvider.AIRTEL,
        name: 'Airtel',
        logo: '/images/networks/airtel.png',
        color: '#FF0000',
      },
      {
        id: NetworkProvider.GLO,
        name: 'Glo',
        logo: '/images/networks/glo.png',
        color: '#00FF00',
      },
      {
        id: NetworkProvider.MOBILE_9,
        name: '9mobile',
        logo: '/images/networks/9mobile.png',
        color: '#006400',
      },
    ];

    const denominations = getAirtimeDenominations();

    return NextResponse.json({
      providers,
      denominations,
      detectNetwork: true, // Indicates client can use phone number detection
    });
  } catch (error) {
    console.error('Failed to get VTU providers:', error);
    return NextResponse.json(
      { error: 'Failed to get providers' },
      { status: 500 }
    );
  }
}

// POST /api/vtu/providers - Detect network from phone number
export async function POST(request: Request) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const provider = detectNetworkProvider(phoneNumber);

    return NextResponse.json({
      detected: !!provider,
      provider,
    });
  } catch (error) {
    console.error('Failed to detect network:', error);
    return NextResponse.json(
      { error: 'Failed to detect network' },
      { status: 500 }
    );
  }
}
