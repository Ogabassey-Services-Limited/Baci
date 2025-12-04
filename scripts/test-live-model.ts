import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { writeFileSync } from 'fs';

async function testLiveModel() {
    const apiKey = 'AIzaSyDex2IQ2a_Aj53jB4h1a6qhb7btCDv8FLU';
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
    } catch (error: any) {
        console.log('❌ Error:', error.message.substring(0, 200));
    }
}

testLiveModel();
