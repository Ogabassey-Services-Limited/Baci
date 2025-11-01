
import { NextRequest, NextResponse } from 'next/server';
import { guideBusinessOnboarding } from '@/ai/flows/guide-business-onboarding';
import { logger } from '@/lib/logger';

// Fallback colors when AI fails - returns 3 colors
function generateFallbackColors(brandPreferences?: string): Record<string, string> {
  const pref = (brandPreferences || '').toLowerCase();

  const colorMap: Record<string, Record<string, string>> = {
    red: { primary: '#EF4444', secondary: '#F87171', accent: '#FCD34D' },
    orange: { primary: '#F97316', secondary: '#FB923C', accent: '#FBBF24' },
    yellow: { primary: '#FBBF24', secondary: '#FCD34D', accent: '#60A5FA' },
    green: { primary: '#10B981', secondary: '#34D399', accent: '#F472B6' },
    blue: { primary: '#2563EB', secondary: '#60A5FA', accent: '#FBBF24' },
    purple: { primary: '#8B5CF6', secondary: '#A78BFA', accent: '#FCD34D' },
    pink: { primary: '#EC4899', secondary: '#F472B6', accent: '#60A5FA' },
    black: { primary: '#1F2937', secondary: '#6B7280', accent: '#FBBF24' },
    default: { primary: '#3F51B5', secondary: '#9C27B0', accent: '#FFC107' },
  };

  for (const [key, colors] of Object.entries(colorMap)) {
    if (pref.includes(key)) {
      return colors;
    }
  }

  return colorMap.default;
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
        // Return an empty array for logos instead of an error
        return NextResponse.json({ logos: [] });
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
      
      if (task === 'generate_logos') {
        // Instead of throwing an error, return an empty array of logos.
        // The frontend will handle this gracefully.
        return NextResponse.json({ logos: [] });
      }

      // For other tasks, it's still okay to throw an error.
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
