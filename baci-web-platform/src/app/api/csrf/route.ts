import { NextResponse } from 'next/server';
import { setCsrfToken } from '@/lib/csrf';

/**
 * GET /api/csrf
 * Initialize or refresh CSRF token
 */
export async function GET() {
  try {
    const token = await setCsrfToken();

    return NextResponse.json({
      token,
      message: 'CSRF token initialized successfully',
    });
  } catch (error) {
    console.error('Error initializing CSRF token:', error);
    return NextResponse.json(
      { error: 'Failed to initialize CSRF token' },
      { status: 500 }
    );
  }
}
