import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const IMG_DIR = '/Users/mac/Baci-app/Baci/public/website designs';
const OUTPUT_FILE = 'scripts/brand_matches.jsonl';

function normalize(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
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

function getSimilarity(s1: string, s2: string): number {
    const bigrams1 = getBigrams(s1);
    const bigrams2 = getBigrams(s2);
    const intersection = bigrams1.filter(a => bigrams2.includes(a)).length;
    const total = bigrams1.length + bigrams2.length;
    return total === 0 ? 0 : (2 * intersection) / total;
}

function getBigrams(str: string): string[] {
    const s = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bigrams: string[] = [];
    for (let i = 0; i < s.length - 1; i++) {
        bigrams.push(s.substring(i, i + 2));
    }
    return bigrams;
}

async function run() {
    console.log('🚀 Starting Multi-Brand Matching...');

    // 1. Get All Unmatched Products
    const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, slug, images');

    const unmatched = allProducts?.filter(p => !p.images || p.images.length === 0 || p.images[0] === null) || [];
    console.log(`📉 Unmatched Products: ${unmatched.length}`);

    // 2. Get All Images
    const allImages = getAllImages(IMG_DIR);

    // 3. Match Logic per Brand
    const matches = [];

    const BRANDS = ['Apple', 'Tecno', 'Infinix', 'Dell', 'HP', 'Google', 'Xiaomi', 'Redmi', 'Oppo', 'Vivo', 'Itel'];

    unmatched.forEach(p => {
        const pName = normalize(p.name);

        // Determine Brand
        const brand = BRANDS.find(b => pName.includes(b.toLowerCase()));
        if (!brand) return;

        // Filter images for this brand ONLY
        const brandImages = allImages.filter(img => normalize(path.basename(img)).includes(brand.toLowerCase()));

        // Find best match
        let bestMatch = { file: '', score: 0 };

        brandImages.forEach(img => {
            const iName = normalize(path.basename(img));

            // Score
            const sim = getSimilarity(pName, iName);

            // Boost if Model Number matches exactly
            const pNums = (pName.match(/\b\d+\b/g) || []);
            const iNums = (iName.match(/\b\d+\b/g) || []);
            const intersection = pNums.filter(n => iNums.includes(n));

            let finalScore = sim;
            if (pNums.length > 0 && intersection.length === pNums.length) finalScore += 0.3; // Perfect number match
            else if (intersection.length > 0) finalScore += 0.1; // Partial number match
            else if (pNums.length > 0 && iNums.length > 0) finalScore -= 0.5; // Number mismatch penalty!

            // Series logic (e.g. "Spark 10" vs "Spark 20")
            // If main word matches (Spark, Camon, iPhone, Watch, Latitude)
            const keywords = ['spark', 'camon', 'pop', 'iphone', 'watch', 'macbook', 'latitude', 'elitebook', 'pixel', 'redmi', 'note'];
            const sharedKeywords = keywords.filter(k => pName.includes(k) && iName.includes(k));
            if (sharedKeywords.length > 0) finalScore += 0.2;

            if (finalScore > bestMatch.score) {
                bestMatch = { file: img, score: finalScore };
            }
        });

        if (bestMatch.score > 0.65) {
            matches.push({
                productId: p.id,
                productName: p.name,
                matchedImage: bestMatch.file,
                brand: brand,
                confidence: bestMatch.score
            });
        }
    });

    console.log(`\n📊 Matches Found: ${matches.length}`);

    // Dedup by Product ID (keep highest score)
    const uniqueMatches = new Map();
    matches.forEach(m => {
        if (!uniqueMatches.has(m.productId) || uniqueMatches.get(m.productId).confidence < m.confidence) {
            uniqueMatches.set(m.productId, m);
        }
    });

    console.log(`📊 Unique Matches: ${uniqueMatches.size}`);

    // Save
    const jsonl = Array.from(uniqueMatches.values()).map((m: any) => JSON.stringify({
        productId: m.productId,
        productName: m.productName,
        matchedImageFilename: m.matchedImage,
        confidence: m.confidence
    })).join('\n');

    fs.writeFileSync(OUTPUT_FILE, jsonl);

    // Preview
    console.log('\n👀 Sample Matches:');
    Array.from(uniqueMatches.values()).slice(0, 10).forEach((m: any) => {
        console.log(`   [${m.brand}] ${m.productName} -> ${path.basename(m.matchedImage)}`);
    });
}

run();
