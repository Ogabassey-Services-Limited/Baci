import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

async function testAlternativeModels() {
    const apiKey = 'AIzaSyDex2IQ2a_Aj53jB4h1a6qhb7btCDv8FLU';

    console.log('--- Testing Alternative Models ---\n');

    const google = createGoogleGenerativeAI({ apiKey });

    const modelsToTest = [
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-001',
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
            console.log(`   Response: "${result.text.substring(0, 50)}..."`);
            console.log(`   Latency: ${duration}ms`);
            console.log(`   ✨ This model has available quota!`);
            break; // Stop once we find a working model
        } catch (error: any) {
            console.log('❌ FAILED');

            if (error.message.includes('429') || error.message.includes('quota')) {
                console.log('   Reason: Quota exceeded');
            } else if (error.message.includes('404')) {
                console.log('   Reason: Model not found');
            } else {
                console.log(`   Reason: ${error.message.split('\n')[0]}`);
            }
        }
    }
}

testAlternativeModels();
