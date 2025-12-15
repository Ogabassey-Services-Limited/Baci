import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testModels() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

    console.log('--- Testing Gemini 2.5 Flash Image Versions ---\n');

    if (!apiKey) {
        console.error('ERROR: No API key found');
        return;
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const modelsToTest = [
        'gemini-2.5-flash-image',          // Stable
        'gemini-2.5-flash-image-preview',  // Preview
    ];

    for (const modelName of modelsToTest) {
        console.log(`\n📍 Testing: ${modelName}`);
        console.log('─'.repeat(50));

        try {
            const start = Date.now();
            const result = await generateText({
                model: google(modelName),
                prompt: 'Say "Working!" if you can read this.',
            });
            const duration = Date.now() - start;

            console.log('✅ SUCCESS!');
            console.log(`   Response: "${result.text}"`);
            console.log(`   Latency: ${duration}ms`);
        } catch (error) {
            console.log('❌ FAILED');
            const errorMsg = error instanceof Error ? error.message : String(error);

            if (errorMsg.includes('429') || errorMsg.includes('quota')) {
                console.log('   Reason: Quota exceeded (limit may be 0)');
            } else if (errorMsg.includes('404')) {
                console.log('   Reason: Model not found');
            } else {
                console.log(`   Reason: ${errorMsg.split('\n')[0]}`);
            }
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Test complete!');
}

testModels();
