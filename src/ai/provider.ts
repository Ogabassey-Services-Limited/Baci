import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Configure Google AI provider with API key from environment
const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY,
});

// Export configured models (using actual model names from Google's API)
export const geminiFlash = google('gemini-2.5-flash'); // Stable, cheapest
export const geminiPro = google('gemini-2.5-pro'); // More powerful
export const geminiImage = google('gemini-2.5-flash-image-preview'); // For image generation/editing
