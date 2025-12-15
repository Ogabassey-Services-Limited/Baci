import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const IMG_DIR = '/Users/mac/Baci-app/Baci/public/website designs';
const OUTPUT_FILE = 'scripts/gallery_matches.json';

function normalize(str: string): string {
    return str.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Remove color words to get base model
function getBaseModel(name: string): string {
    const colors = ['black', 'white', 'red', 'blue', 'green', 'gold', 'silver', 'midnight', 'starlight',
        'pink', 'purple', 'graphite', 'platinum', 'cream', 'navy', 'olive', 'lavender',
        'yellow', 'orange', 'titanium', 'space gray', 'rose', 'coral'];
    let base = normalize(name);
    colors.forEach(c => { base = base.replace(new RegExp(`\\b${c}\\b`, 'g'), ''); });
    // Also remove storage specs for matching base model
    base = base.replace(/\b\d+\s*(gb|tb|mm)\b/g, '');
    return base.replace(/\s+/g, ' ').trim();
}

function getAllImages(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllImages(filePath));
        } else {
            if (!file.startsWith('.')) results.push(filePath);
        }
    });
    return results;
}

async function run() {
    console.log('🚀 Starting Gallery Matching (Multi-Image per Product)...');

    // 1. Get ALL Products (not just unmatched, to add more images to existing)
    const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, slug, images');

    console.log(`📦 Total Products: ${allProducts?.length}`);

    // 2. Get All Images
    const allImages = getAllImages(IMG_DIR);
    console.log(`🖼️  Total Images: ${allImages.length}`);

    // 3. Build Image Index by Base Model
    const imagesByBase = new Map<string, string[]>();

    allImages.forEach(img => {
        const filename = path.basename(img, path.extname(img));
        const base = getBaseModel(filename);
        if (!imagesByBase.has(base)) imagesByBase.set(base, []);
        imagesByBase.get(base)!.push(img);
    });

    console.log(`📊 Unique Base Models in Images: ${imagesByBase.size}`);

    // 4. Match Products to ALL relevant images
    const galleries: { productId: string; productName: string; slug: string; images: string[] }[] = [];

    allProducts?.forEach(p => {
        const productBase = getBaseModel(p.name);

        // Find matching images
        let matchedImages: string[] = [];

        imagesByBase.forEach((imgs, imageBase) => {
            // Check for significant overlap (base model match)
            // e.g. "apple watch series 8" matches "apple watch series 8"
            if (productBase.includes(imageBase) || imageBase.includes(productBase)) {
                // Only if substantial match (not just "apple" in "apple watch")
                if (imageBase.length > 10 || productBase.length > 10) {
                    const shorter = productBase.length < imageBase.length ? productBase : imageBase;
                    const longer = productBase.length >= imageBase.length ? productBase : imageBase;
                    if (longer.includes(shorter) && shorter.length > longer.length * 0.5) {
                        matchedImages = matchedImages.concat(imgs);
                    }
                }
            }
        });

        // Deduplicate
        matchedImages = [...new Set(matchedImages)];

        if (matchedImages.length > 0) {
            galleries.push({
                productId: p.id,
                productName: p.name,
                slug: p.slug,
                images: matchedImages
            });
        }
    });

    console.log(`\n📊 Products with Gallery Matches: ${galleries.length}`);

    // Show examples
    console.log('\n👀 Sample Galleries:');
    galleries.filter(g => g.images.length > 1).slice(0, 5).forEach(g => {
        console.log(`\n   ${g.productName} (${g.images.length} images):`);
        g.images.slice(0, 4).forEach(img => console.log(`     - ${path.basename(img)}`));
    });

    // Save
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(galleries, null, 2));
    console.log(`\n💾 Saved to ${OUTPUT_FILE}`);
}

run();
