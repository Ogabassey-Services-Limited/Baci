import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { writeFileSync } from 'fs';

async function testLogoGeneration() {
    const apiKey = 'AIzaSyDex2IQ2a_Aj53jB4h1a6qhb7btCDv8FLU';
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
