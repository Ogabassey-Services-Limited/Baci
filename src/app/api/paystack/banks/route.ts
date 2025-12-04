import { NextResponse } from 'next/server';
import { getBanks } from '@/lib/paystack';

export async function GET() {
  try {
    const banks = await getBanks();
    return NextResponse.json({ banks });
  } catch (error) {
    console.error('API Error fetching banks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch banks' },
      { status: 500 }
    );
  }
}
