
import { NextRequest, NextResponse } from 'next/server';
import { guideBusinessOnboarding } from '@/ai/flows/guide-business-onboarding';
import { logger } from '@/lib/logger';

// Fallback colors when AI fails
function generateFallbackColors(brandPreferences?: string): string[] {
  // Simple color palettes based on preferences
  const colorPalettes: Record<string, string[]> = {
    blue: ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'],
    green: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'],
    purple: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE'],
    red: ['#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2'],
    orange: ['#F97316', '#FB923C', '#FDBA74', '#FED7AA', '#FFEDD5'],
    default: ['#3F51B5', '#9C27B0', '#FFC107', '#F5F5F5', '#212121'], // Original Baci colors
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
    const { businessName, businessType, brandPreferences, logoDataUri, task } = body;

    if (!businessName || !businessType || !task) {
      return NextResponse.json(
        { error: 'Missing required fields: businessName, businessType, and task are required' },
        { status: 400 }
      );
    }
    
    if (task === 'extract_colors' && !logoDataUri) {
        return NextResponse.json({ error: 'logoDataUri is required for color extraction' }, { status: 400 });
    }

    // Check if Google AI API key is configured
    const hasGoogleAI = !!process.env.GOOGLE_GENAI_API_KEY;

    if (!hasGoogleAI) {
      logger.warn({ message: 'No Google AI API key found, using instant fallback' });
      if (task === 'extract_colors') {
        return NextResponse.json({ brandColors: generateFallbackColors(brandPreferences) });
      }
      if (task === 'generate_logos') {
        return NextResponse.json({ error: 'Logo generation is unavailable without an AI API key.' }, { status: 503 });
      }
    }

    try {
      logger.info({ message: `Attempting AI task: ${task}`});
      // Pass the entire body to the AI flow
      const result = await guideBusinessOnboarding(body);

      return NextResponse.json(result);
    } catch (aiError) {
      logger.error({ message: `AI service failed for task: ${task}`, error: aiError });

      // Fallback only for color extraction
      if (task === 'extract_colors') {
        const fallbackColors = generateFallbackColors(brandPreferences);
        return NextResponse.json({ brandColors: fallbackColors });
      }
      
      // For logo generation, we re-throw to let the client know it failed.
      return NextResponse.json({ error: 'AI service failed to complete the task.' }, { status: 500 });
    }
  } catch (error) {
    logger.error({ message: 'API error in /api/ai/guide-onboarding', error });
    return NextResponse.json(
      { error: 'Failed to process onboarding request' },
      { status: 500 }
    );
  }
}
