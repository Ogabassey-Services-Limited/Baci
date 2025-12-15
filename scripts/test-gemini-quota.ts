import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function checkQuota() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

    console.log('--- Google AI API Quota Check ---');
    console.log(`API Key found: ${apiKey ? 'Yes' : 'No'}`);
    if (!apiKey) {
        console.error('ERROR: No API key found in .env or .env.local');
        return;
    }

    const google = createGoogleGenerativeAI({
        apiKey: apiKey,
    });

    const modelName = 'gemini-2.5-flash-image';
    console.log(`\nTesting model: ${modelName}`);

    try {
        const start = Date.now();
        const result = await generateText({
            model: google(modelName),
            prompt: 'Hello, are you working? Reply with "Yes".',
        });
        const duration = Date.now() - start;

        console.log('✅ Success!');
        console.log(`Response: "${result.text}"`);
        console.log(`Latency: ${duration}ms`);
        console.log('\nYour API key and quota are working correctly for text generation.');
    } catch (error) {
        console.log('❌ Request Failed');
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.includes('429') || errorMsg.includes('quota')) {
            console.error('\n🔴 QUOTA EXCEEDED (429)');
            console.error('Details:', errorMsg);
            console.error('\nPossible causes:');
            console.error('1. Free tier rate limit reached (usually resets every minute)');
            console.error('2. "Limit: 0" means this model is not available for your account/region');
            console.error('3. Billing is not enabled for this project');
        } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
            console.error('\n🔴 MODEL NOT FOUND (404)');
            console.error(`The model "${modelName}" is not available for your API key.`);
        } else {
            console.error('\n🔴 UNEXPECTED ERROR');
            console.error(error);
        }
    }
}

checkQuota().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
