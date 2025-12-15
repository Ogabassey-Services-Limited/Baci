import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testGemini3Flash() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
        console.error('No API key found');
        return;
    }

    const google = createGoogleGenerativeAI({ apiKey });

    console.log('--- Testing Gemini 3 Flash Availability ---\n');

    // Potential model names to test
    const modelsToTest = [
        'gemini-3.0-flash',
        'gemini-3.0-flash-exp',
        'gemini-3.0-flash-preview',
        'gemini-3.0-flash-001'
    ];

    for (const modelName of modelsToTest) {
        console.log(`\n📍 Testing: ${modelName}`);
        console.log('─'.repeat(50));

        try {
            const result = await generateText({
                model: google(modelName),
                prompt: 'Say "Hello" if you work.',
            });

            console.log('✅ SUCCESS!');
            console.log(`   Response: "${result.text}"`);
            console.log('   ✨ This model is available!');

            // If available, test image generation
            try {
                console.log('   Testing image generation...');
                const imgResult = await generateText({
                    model: google(modelName),
                    prompt: 'Generate a small blue circle image.',
                });

                if (imgResult.files && imgResult.files.length > 0) {
                    console.log('   🎨 Image generation SUPPORTED!');
                } else {
                    console.log('   ⚠️ Image generation NOT supported (text only).');
                }
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.log(`   ⚠️ Image generation failed: ${errorMsg.split('\n')[0]}`);
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes('404') || errorMsg.includes('not found')) {
                console.log('❌ Model not found');
            } else if (errorMsg.includes('429')) {
                console.log('❌ Quota exceeded (Model exists but limit reached)');
            } else {
                console.log(`❌ Error: ${errorMsg.split('\n')[0]}`);
            }
        }
    }
}

testGemini3Flash();
