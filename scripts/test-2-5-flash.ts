import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testGemini25Flash() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('ERROR: No API key found. Set GOOGLE_GENAI_API_KEY in .env');
        return;
    }
    const google = createGoogleGenerativeAI({ apiKey });

    console.log('--- Testing gemini-2.5-flash for Image Generation ---\n');

    const modelName = 'gemini-2.5-flash';
    console.log(`Model: ${modelName}\n`);

    try {
        const result = await generateText({
            model: google(modelName),
            prompt: `Generate a professional, modern logo image for a coffee shop called "Brew Haven" with brown and cream colors. Create a simple, clean design suitable for a website.`,
        });

        console.log('✅ Request successful!');
        console.log(`Text response: ${result.text?.substring(0, 150) || 'None'}...`);
        console.log(`Files generated: ${result.files?.length || 0}`);

        if (result.files && result.files.length > 0) {
            console.log('\n🎨 IMAGES GENERATED!');
            result.files.forEach((file, i) => {
                console.log(`  File ${i + 1}: ${file.mediaType}, ${file.base64?.length || 0} chars`);
                if (file.base64 && file.mediaType.startsWith('image/')) {
                    const buffer = Buffer.from(file.base64, 'base64');
                    const filename = `test-logo-flash-${Date.now()}.png`;
                    writeFileSync(filename, buffer);
                    console.log(`  ✅ Saved to: ${filename}`);
                }
            });
            console.log('\n✨ gemini-2.5-flash CAN generate images!');
        } else {
            console.log('\n⚠️ No images generated - text-only response');
            console.log('This model does not support image generation.');
        }
    } catch (error: any) {
        console.log('❌ Error:');
        console.error(error.message.substring(0, 300));
    }
}

testGemini25Flash();
