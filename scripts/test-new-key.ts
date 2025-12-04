import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

async function testNewKey() {
    const apiKey = 'AIzaSyDex2IQ2a_Aj53jB4h1a6qhb7btCDv8FLU';

    console.log('--- Testing New API Key ---\n');
    console.log(`API Key: ${apiKey.substring(0, 10)}...`);

    const google = createGoogleGenerativeAI({ apiKey });

    const modelName = 'gemini-2.5-flash-image';
    console.log(`\nTesting model: ${modelName}\n`);

    try {
        const start = Date.now();
        const result = await generateText({
            model: google(modelName),
            prompt: 'Generate a simple image of a blue circle. Just create the image.',
        });
        const duration = Date.now() - start;

        console.log('✅ SUCCESS!');
        console.log(`Response text: "${result.text}"`);
        console.log(`Latency: ${duration}ms`);
        console.log(`Files generated: ${result.files?.length || 0}`);

        if (result.files && result.files.length > 0) {
            console.log('\n🎨 Image generation confirmed!');
            result.files.forEach((file, idx) => {
                console.log(`  File ${idx + 1}: ${file.mediaType}`);
            });
        }

        console.log('\n✨ This API key works! It has available quota.');
    } catch (error: any) {
        console.log('❌ FAILED\n');

        if (error.message.includes('429') || error.message.includes('quota')) {
            console.log('🔴 QUOTA EXCEEDED');
            console.log('This key also has quota issues.');
        } else if (error.message.includes('401') || error.message.includes('403')) {
            console.log('🔴 AUTHENTICATION ERROR');
            console.log('This key may be invalid or restricted.');
        } else if (error.message.includes('404')) {
            console.log('🔴 MODEL NOT FOUND');
            console.log('The model is not available for this key.');
        } else {
            console.log('Error:', error.message);
        }
    }
}

testNewKey();
