import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PRIMARY_IMAGE_DIR = '/Users/mac/Baci-app/Baci/public/website designs';
const CDN_BASE = 'https://cdn.ogabassey.com/products';

// Find all AVIF and WebP images recursively
function findImages(dir: string): string[] {
    const images: string[] = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            images.push(...findImages(fullPath));
        } else if (/\.(avif|webp)$/i.test(item.name)) {
            images.push(fullPath);
        }
    }
    return images;
}

// Known brands for matching
const BRANDS = ['apple', 'samsung', 'tecno', 'infinix', 'redmi', 'xiaomi', 'google', 'pixel', 'vivo', 'oppo', 'iphone', 'ipad', 'macbook', 'airpods', 'ps5', 'ps4', 'playstation', 'nintendo', 'switch', 'xbox'];

// Extract brand from name
function extractBrand(name: string): string | null {
    const lower = name.toLowerCase();
    for (const brand of BRANDS) {
        if (lower.includes(brand)) {
            return brand;
        }
    }
    return null;
}

// Extract searchable name from image filename
function extractSearchName(filePath: string): { name: string; brand: string | null } {
    const filename = path.basename(filePath, path.extname(filePath));
    const cleaned = filename
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
    return { name: cleaned, brand: extractBrand(cleaned) };
}

// Extract searchable name from product
function extractProductName(name: string): { name: string; brand: string | null } {
    const cleaned = name
        .replace(/\d+GB/gi, '')
        .replace(/\d+TB/gi, '')
        .replace(/\(New\)/gi, '')
        .replace(/\(Used\)/gi, '')
        .replace(/\(Open Box\)/gi, '')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
    return { name: cleaned, brand: extractBrand(cleaned) };
}

// Calculate similarity score (brand-aware + number-aware)
function similarity(productInfo: { name: string; brand: string | null }, imageInfo: { name: string; brand: string | null }): number {
    // Brand mismatch = no match
    if (productInfo.brand && imageInfo.brand && productInfo.brand !== imageInfo.brand) {
        // Allow some brand aliases
        const aliases: Record<string, string[]> = {
            'iphone': ['apple'],
            'ipad': ['apple'],
            'macbook': ['apple'],
            'airpods': ['apple'],
            'pixel': ['google'],
            'redmi': ['xiaomi'],
            'ps5': ['playstation'],
            'ps4': ['playstation'],
            'switch': ['nintendo'],
        };
        const productAliases = [productInfo.brand, ...(aliases[productInfo.brand] || [])];
        const imageAliases = [imageInfo.brand, ...(aliases[imageInfo.brand] || [])];

        if (!productAliases.some(a => imageAliases.includes(a))) {
            return 0;
        }
    }

    // Extract model numbers (e.g., "40" from "Spark 40")
    const productNumbers = productInfo.name.match(/\b(\d+)\b/g) || [];
    const imageNumbers = imageInfo.name.match(/\b(\d+)\b/g) || [];

    // If product has numbers, at least one must match
    if (productNumbers.length > 0) {
        const hasNumberMatch = productNumbers.some(pn => imageNumbers.includes(pn));
        if (!hasNumberMatch) {
            return 0; // No number match = reject
        }
    }

    const wordsA = productInfo.name.split(' ').filter(w => w.length > 2);
    const wordsB = imageInfo.name.split(' ').filter(w => w.length > 2);
    let matches = 0;

    for (const wordA of wordsA) {
        if (wordsB.some(wordB => wordB === wordA || wordB.includes(wordA) || wordA.includes(wordB))) {
            matches++;
        }
    }

    return wordsA.length > 0 ? matches / wordsA.length : 0;
}

async function matchImages() {
    console.log('🔍 Finding primary images...');
    const images = findImages(PRIMARY_IMAGE_DIR);
    console.log(`Found ${images.length} primary images`);

    // Create a lookup array for images with extracted info
    const imageData: Array<{ info: { name: string; brand: string | null }; path: string }> = [];
    for (const img of images) {
        imageData.push({ info: extractSearchName(img), path: img });
    }

    console.log('\n📦 Fetching products from database...');
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, images');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${products?.length} products\n`);

    let matched = 0;
    let unmatched = 0;
    const results: { product: string; image: string | null; score: number }[] = [];

    for (const product of products || []) {
        const productName = extractProductName(product.name);
        let bestMatch: string | null = null;
        let bestScore = 0;

        for (const { info: imageInfo, path: imagePath } of imageData) {
            const score = similarity(productName, imageInfo);
            if (score > bestScore && score > 0.4) {
                bestScore = score;
                bestMatch = imagePath;
            }
        }

        if (bestMatch) {
            matched++;
            results.push({ product: product.name, image: path.basename(bestMatch), score: bestScore });
            console.log(`✅ ${product.name}`);
            console.log(`   → ${path.basename(bestMatch)} (${(bestScore * 100).toFixed(0)}%)`);
        } else {
            unmatched++;
            results.push({ product: product.name, image: null, score: 0 });
            console.log(`❌ ${product.name} - no match`);
        }
    }

    console.log(`\n📊 Summary: ${matched} matched, ${unmatched} unmatched out of ${products?.length}`);
}

matchImages().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
