import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testLogoGeneration() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('ERROR: No API key found. Set GOOGLE_GENAI_API_KEY in .env');
        return;
    }
    const google = createGoogleGenerativeAI({ apiKey });

    console.log('--- Testing Logo Generation ---\n');

    const modelName = 'gemini-2.5-flash-image';
    console.log(`Model: ${modelName}\n`);

    try {
        const start = Date.now();
        const result = await generateText({
            model: google(modelName),
            prompt: `Generate a professional, modern, and minimalist logo image for a business.

Business Name: "Test Coffee Shop"
Business Type: Food & Beverage
Color Preferences: brown and cream

Requirements:
- Clean, vector-like design suitable for a website header
- High contrast with simple, recognizable shapes
- White or transparent background
- Professional and memorable

Please generate the logo image now.`,
        });
        const duration = Date.now() - start;

        console.log('✅ SUCCESS!');
        console.log(`Latency: ${duration}ms`);
        console.log(`Text response: ${result.text?.substring(0, 100) || 'None'}`);
        console.log(`Files generated: ${result.files?.length || 0}`);

        if (result.files && result.files.length > 0) {
            console.log('\n🎨 LOGO GENERATED!');
            result.files.forEach((file, idx) => {
                console.log(`  File ${idx + 1}: ${file.mediaType}, ${file.base64?.length || 0} bytes`);
                if (file.base64 && file.mediaType.startsWith('image/')) {
                    // Save the image
                    const buffer = Buffer.from(file.base64, 'base64');
                    const filename = `test-logo-${Date.now()}.png`;
                    writeFileSync(filename, buffer);
                    console.log(`  Saved to: ${filename}`);
                }
            });
            console.log('\n✨ Logo generation is WORKING with this API key!');
        } else {
            console.log('\n⚠️ No images generated (might be text-only response)');
        }
    } catch (error: any) {
        console.log('❌ FAILED\n');
        console.error(error.message);
    }
}

testLogoGeneration();
