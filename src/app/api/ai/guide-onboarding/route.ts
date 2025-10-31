import { NextRequest, NextResponse } from 'next/server';
import { guideBusinessOnboarding } from '@/ai/flows/guide-business-onboarding';

// Fallback colors when AI fails
function generateFallbackColors(brandPreferences?: string): string[] {
  // Simple color palettes based on preferences
  const colorPalettes: Record<string, string[]> = {
    blue: ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'],
    green: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'],
    purple: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE'],
    red: ['#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2'],
    orange: ['#F97316', '#FB923C', '#FDBA74', '#FED7AA', '#FFEDD5'],
    default: ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'],
  };

  const pref = (brandPreferences || '').toLowerCase();
  for (const [key, colors] of Object.entries(colorPalettes)) {
    if (pref.includes(key)) {
      return colors;
    }
  }
  return colorPalettes.default;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, businessType, brandPreferences, logoDataUri } = body;

    if (!businessName || !businessType) {
      return NextResponse.json(
        { error: 'Missing required fields: businessName and businessType are required' },
        { status: 400 }
      );
    }

    // Check if Google AI API key is configured
    const hasGoogleAI = !!process.env.GOOGLE_GENAI_API_KEY;

    if (!hasGoogleAI) {
      // Skip AI initialization entirely if no API key - use fallback immediately
      console.log('⚡ No Google AI API key found, using instant fallback');
      const fallbackColors = generateFallbackColors(brandPreferences);

      return NextResponse.json({
        logoDataUri: logoDataUri || null,
        brandColors: fallbackColors,
      });
    }

    try {
      // Try AI service only if API key exists
      console.log('🤖 Google AI API key found, attempting AI generation');
      const result = await guideBusinessOnboarding({
        businessName,
        businessType,
        brandPreferences: brandPreferences || '',
        logoDataUri: logoDataUri || undefined,
      });

      return NextResponse.json(result);
    } catch (aiError) {
      // Fallback to mock data if AI fails
      console.warn('AI service failed, using fallback:', aiError);

      const fallbackColors = generateFallbackColors(brandPreferences);

      return NextResponse.json({
        logoDataUri: logoDataUri || null,
        brandColors: fallbackColors,
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to process onboarding request' },
      { status: 500 }
    );
  }
}
