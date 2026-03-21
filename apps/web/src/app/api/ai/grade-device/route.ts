import { GoogleGenerativeAI } from '@google/generative-ai';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { createAnonClient } from '@/lib/supabase/anon';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || ''
);

export async function POST(req: NextRequest) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(req);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const formData = await req.formData();
    const file = formData.get('video') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    // 1. Process Video
    // Convert File to ArrayBuffer -> Base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 2. AI Analysis
    // Use gemini-3-flash-preview for advanced video reasoning and accuracy
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `
      You are an expert mobile device grader. Analyze this video of a smartphone.
      1. Identify the exact phone model (e.g. "iPhone 13 Pro", "Samsung S22 Ultra").
      2. Grade the cosmetic condition based on VISIBLE flaws (screen cracks, scratches, dents).
         - "Excellent": Near perfect.
         - "Good": Minor scratches, no cracks.
         - "Fair": Visible scratches or minor dents.
         - "Poor": Cracked screen, heavy damage.
      3. List 2-3 specific visual observations supporting your grade.
      
      Return ONLY valid JSON in this format:
      {
        "model": "Identified Model Name",
        "grade": "Excellent" | "Good" | "Fair" | "Poor",
        "observations": ["observation 1", "observation 2"],
        "confidence": 0-100
      }
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: file.type,
          data: base64Data,
        },
      },
    ]);

    const responseText = result.response.text();
    // Clean code fences if present
    const cleanJson = responseText.replace(/```json|```/g, '').trim();

    interface AIAnalysisResult {
      model: string;
      grade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
      observations: string[];
      confidence: number;
    }
    let aiData: AIAnalysisResult = {} as AIAnalysisResult;

    try {
      aiData = JSON.parse(cleanJson);
    } catch {
      console.error('Failed to parse Gemini response:', responseText);
      return NextResponse.json(
        { error: 'AI analysis failed to produce valid data' },
        { status: 500 }
      );
    }

    // 3. Price Lookup (Supabase)
    // Public endpoint for mobile uploads: use anon client (no cookie session required).
    const supabase = createAnonClient();

    // Fuzzy search for the model in products
    const { data: products } = await supabase
      .from('products')
      .select('name, price, image')
      .ilike('name', `%${aiData.model}%`)
      .limit(3);

    // Determine Base Price
    // Default to a fallback if no match found (or use the highest price found as an optimistic estimate)
    let basePrice = 0;
    let matchName = 'Unknown Device';

    if (products && products.length > 0) {
      // Pick the most expensive one (usually the Pro/Max version if ambiguous) or exact match
      const bestMatch = products.sort((a, b) => b.price - a.price)[0];
      basePrice = bestMatch.price;
      matchName = bestMatch.name;
    } else {
      // Fallback: If we can't find it, ask AI to ESTIMATE the market value in Nigeria (Naira)
      // For this MVP, we'll return null and let frontend handle "Contact us for price"
      // OR set a placeholder
      basePrice = 0;
    }

    // 4. Calculate Final Value
    // Deductions: Excellent (0%), Good (10%), Fair (20%), Poor (40%)
    let deduction = 0;
    switch (aiData.grade) {
      case 'Good':
        deduction = 0.1;
        break;
      case 'Fair':
        deduction = 0.2;
        break;
      case 'Poor':
        deduction = 0.4;
        break;
      default:
        deduction = 0; // Excellent
    }

    const estimatedValue =
      basePrice > 0 ? Math.round(basePrice * (1 - deduction)) : 0;

    return NextResponse.json({
      success: true,
      data: {
        ...aiData,
        basePrice,
        estimatedValue,
        deductionPercent: deduction * 100,
        matchedProduct: matchName,
      },
    });
  } catch (error) {
    console.error('Grade Device Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
