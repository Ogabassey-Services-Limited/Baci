import { NextResponse } from 'next/server';
import { getAirtimeProviders, getBillTypes } from '@/lib/kuda';

/**
 * GET /api/vtu/test
 * Test Kuda API connection
 */
export async function GET() {
  try {
    // Check if credentials are configured
    const hasCredentials = !!(
      process.env.KUDA_EMAIL && process.env.KUDA_API_KEY
    );

    if (!hasCredentials) {
      return NextResponse.json({
        success: false,
        error: 'Kuda credentials not configured',
        details: {
          KUDA_EMAIL: !!process.env.KUDA_EMAIL,
          KUDA_API_KEY: !!process.env.KUDA_API_KEY,
          KUDA_API_BASE_URL: process.env.KUDA_API_BASE_URL || 'default',
        },
      });
    }

    // Test 1: Get bill types (tests authentication)
    console.log('Testing Kuda API connection...');
    const billTypes = await getBillTypes();

    // Test 2: Get airtime providers
    const airtimeProviders = await getAirtimeProviders();

    return NextResponse.json({
      success: true,
      message: 'Kuda API connection successful!',
      data: {
        billTypesCount: billTypes.length,
        billTypes: billTypes.slice(0, 5), // First 5 for brevity
        airtimeProvidersCount: airtimeProviders.length,
        airtimeProviders: airtimeProviders,
      },
    });
  } catch (error) {
    console.error('Kuda API test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack:
                process.env.NODE_ENV === 'development'
                  ? error.stack
                  : undefined,
            }
          : undefined,
    });
  }
}
