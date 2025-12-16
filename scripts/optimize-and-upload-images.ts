
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TARGET_MATCHERS = [
    'HP OMEN MAX',
    'SAMSUNG OLED DISPLAY SMART TV'
];

async function downloadImage(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function optimizeToAvif(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .avif({ quality: 80, effort: 5 }) // Standard web optimization
        .toBuffer();
}

async function uploadToStorage(buffer: Buffer, filename: string): Promise<string> {
    const filePath = `products/${filename}`;
    const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, buffer, {
            contentType: 'image/avif',
            upsert: true
        });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

    return publicUrl;
}

async function main() {
    console.log('🖼️ Optimizing and Uploading Images...');

    for (const matcher of TARGET_MATCHERS) {
        // 1. Find products
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, images, slug')
            .eq('status', 'active')
            .ilike('name', `%${matcher}%`);

        if (error || !products) {
            console.error(`Error finding ${matcher}:`, error);
            continue;
        }

        console.log(`Found ${products.length} products for "${matcher}"`);

        for (const p of products) {
            if (!p.images || p.images.length === 0) continue;

            const currentUrl = p.images[0];
            // Skip if already optimized (sanity check)
            if (currentUrl.includes('.avif') && currentUrl.includes('supabase.co')) {
                console.log(`  Skipping ${p.name} (Already optimized)`);
                continue;
            }

            console.log(`  Processing ${p.name}...`);
            try {
                // 2. Download
                console.log(`    Downloading: ${currentUrl}`);
                const originalBuffer = await downloadImage(currentUrl);

                // 3. Optimize
                console.log('    Converting to AVIF...');
                const avifBuffer = await optimizeToAvif(originalBuffer);

                // 4. Upload
                const filename = `${p.slug}-optimized-${Date.now()}.avif`;
                console.log(`    Uploading as ${filename}...`);
                const publicUrl = await uploadToStorage(avifBuffer, filename);

                // 5. Update DB
                console.log(`    Updating DB -> ${publicUrl}`);
                const { error: updateError } = await supabase
                    .from('products')
                    .update({
                        images: [publicUrl]
                    })
                    .eq('id', p.id);

                if (updateError) {
                    console.error('    ❌ DB Update Failed:', updateError);
                } else {
                    console.log('    ✅ Success!');
                }

            } catch (err) {
                console.error('    ❌ Error processing image:', err);
            }
        }
    }
}

main();
