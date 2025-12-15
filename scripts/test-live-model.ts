import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testLiveModel() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('ERROR: No API key found. Set GOOGLE_GENAI_API_KEY in .env');
        return;
    }
    const google = createGoogleGenerativeAI({ apiKey });

    console.log('--- Testing gemini-2.5-flash-live for Image Generation ---\n');

    const modelName = 'gemini-2.5-flash-native-audio-preview-09-2025';
    console.log(`Model: ${modelName}\n`);

    try {
        const result = await generateText({
            model: google(modelName),
            prompt: `Generate a professional logo image for "Test Coffee Shop" with brown and cream colors.`,
        });

        console.log('✅ Request successful!');
        console.log(`Text: ${result.text?.substring(0, 100)}`);
        console.log(`Files: ${result.files?.length || 0}`);

        if (result.files && result.files.length > 0) {
            console.log('\n🎨 Images generated:');
            result.files.forEach((file, i) => {
                console.log(`  ${i + 1}. ${file.mediaType}`);
            });
        } else {
            console.log('\n⚠️ No images in response - this is a text/audio model, not image generation');
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log('❌ Error:', errorMsg.substring(0, 200));
    }
}

testLiveModel();
