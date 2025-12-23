import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables for standalone execution
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const GENERATED_IMAGES_BUCKET = 'images';
const PARENT_IDS_TO_PROCESS = [
    '094152bc-689b-4c27-8901-325a2ecce92d', // iPhone 16
    'e69eaaf4-74a9-41d7-83fd-5219d24082ba', // iPhone 16 Plus
    'd828ef4e-4b72-49e1-8c6e-96c2071a47ff', // iPhone 16 Pro
    '84ccc7a9-64d8-422c-a6db-18f4bc4f7244', // iPhone 16 Pro Max
    'b68350f2-21d5-4914-b7e5-5c32aa203684', // iPhone 16E
    'dfac4c6c-6c5c-49bf-9df2-14ec0890bb14', // Samsung S24
    'd4c43f2b-dd1e-40a2-8017-7f9fa025e5ea', // Samsung S24+
    'b37b95f8-e5e1-42b4-aa85-ed147d0e187a', // Samsung S24 Ultra
    '974ee898-d819-4652-9b0d-c20cc29338ec', // Samsung S24 FE
];

async function generateImageForProduct(product: any, retryCount = 0) {
    if (retryCount > 3) {
        console.error(`Max retries reached for ${product.name}. Skipping.`);
        return false;
    }

    console.log(`Generating image for: ${product.name} (Attempt ${retryCount + 1})`);

    try {
        const { gemini25FlashImage } = await import('../../src/ai/provider');
        const prompt = `Professional product photography of ${product.name}, centered on a clean white background, high quality, commercial lighting, 4k.`;

        // Generate content using multimodal model
        const { response } = await generateText({
            model: gemini25FlashImage,
            prompt,
            providerOptions: {
                google: {
                    responseModalities: ['IMAGE'],
                },
            },
        });

        // Parse response
        // biome-ignore lint/suspicious/noExplicitAny: AI SDK response type varies
        const parts = (response.body as any)?.candidates?.[0]?.content?.parts || [];
        // biome-ignore lint/suspicious/noExplicitAny: provider type casting
        const imagePart = parts.find((p: any) => p.inlineData);

        if (imagePart && imagePart.inlineData) {
            const imageBase64 = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType || 'image/png';
            const ext = mimeType.split('/')[1] || 'png';

            const buffer = Buffer.from(imageBase64, 'base64');
            const filename = `generated/${product.slug}-${Date.now()}.${ext}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(GENERATED_IMAGES_BUCKET)
                .upload(filename, buffer, {
                    contentType: mimeType,
                    upsert: false,
                });

            if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from(GENERATED_IMAGES_BUCKET)
                .getPublicUrl(filename);

            console.log(`Uploaded to: ${publicUrl}`);

            // Update Product
            const images = Array.isArray(product.images) ? product.images : [];
            const newImages = [...images, publicUrl];

            const { error: updateError } = await supabase
                .from('products')
                .update({ images: newImages })
                .eq('id', product.id);

            if (updateError) throw new Error(`Update failed: ${updateError.message}`);

            console.log(`Successfully updated product: ${product.name}`);
            return true;
        } else {
            // biome-ignore lint/suspicious/noExplicitAny: basic casting
            const finishReason = (response.body as any)?.candidates?.[0]?.finishReason;
            if (finishReason === 'NO_IMAGE') {
                console.log("Model returned NO_IMAGE. It might interpret the prompt as text-only or refuse generation.");
            } else {
                console.log("No image data found in response.", JSON.stringify((response.body as any), null, 2));
            }
            return false;
        }

    } catch (error: any) {
        // Check for 429
        if (error.statusCode === 429 || error.message?.includes('429') || error.message?.includes('Quota')) {
            console.warn(`Quota exceeded. Waiting 35 seconds before retry...`);
            await new Promise(r => setTimeout(r, 35000));
            return generateImageForProduct(product, retryCount + 1);
        }

        console.error(`Failed to generate/upload for ${product.name}:`, error);
        return false;
    }
}

async function main() {
    console.log("Starting image generation test (Gemini 2.5 Flash Image)...");

    // 1. Fetch products
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, images, parent_product_id')
        .in('parent_product_id', PARENT_IDS_TO_PROCESS)
        .limit(10); // Limit to 10 for batch testing

    if (error) {
        console.error("Error fetching products:", error);
        return;
    }

    const targets = (products || []).filter((p: any) => {
        if (!p.images) return true;
        if (Array.isArray(p.images) && p.images.length === 0) return true;
        if (typeof p.images === 'string' && p.images === '[]') return true;
        return false;
    });

    console.log(`Found ${targets.length} candidates. Processing...`);

    for (const product of targets) {
        await generateImageForProduct(product);
        // Wait 10s between successful calls to be nice to the quota
        await new Promise(r => setTimeout(r, 10000));
    }

    console.log("Done.");
}

main();
