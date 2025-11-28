/**
 * AI-Powered Alt Text Generation for Accessibility
 *
 * This utility helps generate meaningful alt text for images to ensure WCAG 2.1 AA compliance.
 * It uses the Gemini AI model to analyze images and generate descriptive alt text.
 *
 * Usage:
 * - Call generateAltText() with an image URL to get AI-generated alt text
 * - For decorative images, the function returns an empty string (per WCAG guidelines)
 * - Use isDecorativeImage() to check if an image should be marked as decorative
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

// Initialize Google AI with API key from environment
const getGoogleAI = () => {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
  }
  return createGoogleGenerativeAI({ apiKey });
};

export interface AltTextResult {
  altText: string;
  isDecorative: boolean;
  confidence: 'high' | 'medium' | 'low';
  context?: string;
}

export interface GenerateAltTextOptions {
  /** Product name or context for better alt text generation */
  productName?: string;
  /** Product category for context */
  category?: string;
  /** Whether this is a product image (helps generate more specific alt text) */
  isProductImage?: boolean;
  /** Maximum length for the alt text (default: 125 characters per WCAG best practices) */
  maxLength?: number;
  /** Language for the alt text (default: 'en') */
  language?: string;
}

/**
 * Generates AI-powered alt text for an image
 *
 * @param imageUrl - The URL of the image to analyze
 * @param options - Options for customizing alt text generation
 * @returns Promise<AltTextResult> - The generated alt text and metadata
 *
 * @example
 * ```ts
 * const result = await generateAltText('https://example.com/product.jpg', {
 *   productName: 'Blue Cotton T-Shirt',
 *   isProductImage: true
 * });
 * console.log(result.altText); // "Blue cotton t-shirt with crew neck, front view"
 * ```
 */
export async function generateAltText(
  imageUrl: string,
  options: GenerateAltTextOptions = {}
): Promise<AltTextResult> {
  const {
    productName,
    category,
    isProductImage = false,
    maxLength = 125,
    language = 'en',
  } = options;

  try {
    const google = getGoogleAI();

    // Build context for the AI
    let contextPrompt = '';
    if (isProductImage && productName) {
      contextPrompt = `This is a product image for "${productName}"${category ? ` in the ${category} category` : ''}.`;
    }

    const prompt = `You are an accessibility expert helping generate alt text for images following WCAG 2.1 AA guidelines.

${contextPrompt}

Analyze this image and generate appropriate alt text. Follow these WCAG best practices:
1. Be concise but descriptive (max ${maxLength} characters)
2. Describe the content and function of the image
3. Don't start with "Image of" or "Picture of" - screen readers already announce it's an image
4. Include relevant details like colors, text, people's actions, or product features
5. For product images: include the product type, key features, color, and perspective if relevant
6. If the image appears decorative (patterns, dividers, backgrounds), indicate that

Respond in JSON format:
{
  "altText": "your alt text here",
  "isDecorative": false,
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation of your analysis"
}

Language for alt text: ${language}`;

    const response = await generateText({
      model: google('gemini-2.5-flash-preview-05-20'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: imageUrl },
          ],
        },
      ],
    });

    // Parse the JSON response
    const responseText = response.text.trim();
    // Extract JSON from markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText;

    const result = JSON.parse(jsonStr);

    return {
      altText: result.isDecorative ? '' : truncateAltText(result.altText, maxLength),
      isDecorative: result.isDecorative || false,
      confidence: result.confidence || 'medium',
      context: result.reasoning,
    };
  } catch (error) {
    console.error('Error generating alt text:', error);

    // Fallback: Generate basic alt text from context
    if (productName) {
      return {
        altText: `${productName}${category ? ` - ${category}` : ''}`,
        isDecorative: false,
        confidence: 'low',
        context: 'Fallback generated from product name due to AI error',
      };
    }

    // If no context available, return empty (user should provide alt manually)
    return {
      altText: '',
      isDecorative: false,
      confidence: 'low',
      context: 'AI analysis failed, manual alt text recommended',
    };
  }
}

/**
 * Batch generate alt text for multiple images
 *
 * @param images - Array of image data with URLs and optional context
 * @returns Promise<Map<string, AltTextResult>> - Map of URL to alt text results
 */
export async function batchGenerateAltText(
  images: Array<{
    url: string;
    productName?: string;
    category?: string;
    isProductImage?: boolean;
  }>
): Promise<Map<string, AltTextResult>> {
  const results = new Map<string, AltTextResult>();

  // Process images in parallel with rate limiting
  const batchSize = 5;
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (image) => {
        const result = await generateAltText(image.url, {
          productName: image.productName,
          category: image.category,
          isProductImage: image.isProductImage ?? true,
        });
        return { url: image.url, result };
      })
    );

    batchResults.forEach(({ url, result }) => {
      results.set(url, result);
    });

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < images.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}

/**
 * Check if an image should be marked as decorative
 * Decorative images should have alt="" (empty string)
 *
 * Common decorative image types:
 * - Background patterns/textures
 * - Divider lines
 * - Purely aesthetic icons that are redundant with text
 * - Spacers
 */
export function isDecorativeImage(context: {
  /** Does the image have adjacent text that describes it? */
  hasAdjacentText?: boolean;
  /** Is this a background/texture pattern? */
  isBackground?: boolean;
  /** Is this a spacer or divider? */
  isSpacer?: boolean;
  /** Is this a decorative icon with redundant text label? */
  hasTextLabel?: boolean;
}): boolean {
  return !!(
    context.isBackground ||
    context.isSpacer ||
    (context.hasAdjacentText && context.hasTextLabel)
  );
}

/**
 * Truncate alt text to maximum length while preserving meaning
 */
function truncateAltText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to break at a word boundary
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace);
  }

  return truncated;
}

/**
 * Generate alt text for a product image with standard e-commerce format
 *
 * @param product - Product data
 * @returns Formatted alt text string
 */
export function generateProductAltText(product: {
  name: string;
  category?: string;
  brand?: string;
  color?: string;
  viewType?: 'front' | 'back' | 'side' | 'detail' | 'lifestyle';
}): string {
  const parts: string[] = [];

  // Start with brand if available
  if (product.brand) {
    parts.push(product.brand);
  }

  // Add color if available
  if (product.color) {
    parts.push(product.color);
  }

  // Add product name (should include the product type)
  parts.push(product.name);

  // Add view type if not front/main view
  if (product.viewType && product.viewType !== 'front') {
    const viewLabels = {
      back: 'back view',
      side: 'side view',
      detail: 'detail shot',
      lifestyle: 'lifestyle image',
    };
    parts.push(viewLabels[product.viewType]);
  }

  return parts.join(' ');
}

/**
 * Validate alt text for WCAG compliance
 *
 * @param altText - The alt text to validate
 * @returns Object with validation result and any issues
 */
export function validateAltText(altText: string): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check length
  if (altText.length > 125) {
    issues.push(`Alt text is too long (${altText.length} chars). Keep under 125 characters.`);
  }

  // Check for common bad patterns
  if (/^(image of|picture of|photo of|graphic of)/i.test(altText)) {
    issues.push('Alt text should not start with "Image of" or similar phrases.');
    suggestions.push('Remove the prefix and start directly with the description.');
  }

  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(altText)) {
    issues.push('Alt text contains filename extension, which is not descriptive.');
    suggestions.push('Replace with a meaningful description of the image content.');
  }

  if (/^IMG_?\d+|^DSC_?\d+|^untitled/i.test(altText)) {
    issues.push('Alt text appears to be a generic filename.');
    suggestions.push('Replace with descriptive text about the image content.');
  }

  if (!altText || altText.trim() === '') {
    // Empty alt is only valid for decorative images
    suggestions.push('Empty alt text is only appropriate for decorative images.');
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
  };
}
