import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testMultiLogo() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
        console.error('No API key found');
        return;
    }

    const google = createGoogleGenerativeAI({ apiKey });

    console.log('--- Testing Multi-Logo Generation (1 Request) ---\n');

    const modelName = 'gemini-2.5-flash-image';

    try {
        const start = Date.now();
        const result = await generateText({
            model: google(modelName),
            prompt: `Generate 4 distinct, professional logo variations for a coffee shop called "Brew Haven".
      
      Variations:
      1. Minimalist text-based
      2. Icon-based with a coffee cup
      3. Abstract geometric shape
      4. Vintage badge style
      
      Return all 4 images in this single response.`,
        });
        const duration = Date.now() - start;

        console.log('✅ Request successful!');
        console.log("Latency:", duration, "ms");
        console.log("Files generated:", result.files?.length || 0);

        if (result.files && result.files.length > 0) {
            console.log('\n🎨 Images generated:');
            result.files.forEach((file, i) => {
                console.log("  " + (i + 1) + ".", file.mediaType, "(" + Math.round((file.base64?.length || 0) / 1024) + " KB)");
            });

            if (result.files.length >= 4) {
                console.log('\n✨ SUCCESS: Model generated multiple images in one request!');
                console.log('   Cost implication: 1 Request (cheaper on RPM), likely billed per image or token output.');
            } else {
                console.log("\n⚠️ PARTIAL: Asked for 4, got", result.files.length + ".");
            }
        } else {
            console.log('\n⚠️ No images generated.');
        }
    } catch (error: any) {
        console.log('❌ Error:', error.message);
    }
}

testMultiLogo();
