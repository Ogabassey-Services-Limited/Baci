import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const IMG_DIR = '/Users/mac/Baci-app/Baci/public/website designs';
const OUTPUT_FILE = 'scripts/heuristic_matches.jsonl';

// Simple Dice Coefficient for string similarity (better than Levenshtein for multi-word refactor)
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

// Helper to normalize strings for comparison
function normalize(str: string): string {
    return str.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ') // Replace symbols with space
        .replace(/\s+/g, ' ')
        .trim();
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
    console.log('🚀 Starting Heuristic Matching...');

    // 1. Get Unmatched Products
    const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, slug, images');

    const unmatchedProducts = allProducts?.filter(p => !p.images || p.images.length === 0 || p.images[0] === null) || [];
    console.log(`📉 Unmatched Products: ${unmatchedProducts.length}`);

    // 2. Get Unused Images
    const allImages = getAllImages(IMG_DIR);
    // (Skipping "used" check for simplicity - if we find a better match, we use it!)

    // 3. Match
    console.log('🔄 Comparing...');
    let exactMatches = 0;
    let highConfMatches = 0;
    let mediumConfMatches = 0;

    const matches = [];

    unmatchedProducts.forEach(p => {
        const pNameNorm = normalize(p.name);

        // Find best match in ALL images
        let bestMatch = { file: '', score: 0 };

        allImages.forEach(img => {
            const filename = path.basename(img, path.extname(img)); // Remove extension
            const fNameNorm = normalize(filename);

            // Check for direct inclusion (very strong signal)
            // e.g. Product: "iPhone 13", File: "iphone-13-blue"
            if (fNameNorm.includes(pNameNorm) || pNameNorm.includes(fNameNorm)) {
                // Boost score if one contains the other
                // But ensure it's not a tiny substring match like "iphone" in "iphone 13"
                if (Math.min(fNameNorm.length, pNameNorm.length) > 5) {
                    const score = Math.max(0.9, getSimilarity(pNameNorm, fNameNorm));
                    if (score > bestMatch.score) bestMatch = { file: img, score };
                }
            } else {
                const score = getSimilarity(pNameNorm, fNameNorm);
                if (score > bestMatch.score) bestMatch = { file: img, score };
            }
        });

        if (bestMatch.score > 0.4) {
            // Safety Check: Number Mismatch
            // Extract numbers from both strings. If product has a specific model number (e.g. "15", "S24"), 
            // the image MUST have it if it has any numbers. 
            const pNumbers = (pNameNorm.match(/\b\d+\b/g) || []).filter(n => !['5g', '4g', '3g', '2g'].includes(n));
            const iNumbers = (path.basename(bestMatch.file).toLowerCase().match(/\b\d+\b/g) || []);

            let isSafe = true;
            // logic: if product has "15", image must not have "14". 
            // But image might be generic "iphone.jpg" (no numbers) -> Safe? Maybe.
            // If image has numbers, they should overlap with product numbers?

            // Stricter rule: If Product has a "Model Number" (like 13, 14, 15, s23, s24), 
            // and Image has a DIFFERENT "Model Number", REJECT.

            // Heuristic: Check intersection of numbers.
            if (pNumbers.length > 0 && iNumbers.length > 0) {
                // If they share NO numbers, it's suspicious (e.g. "Smart 7" vs "Smart 9")
                // Exclude common capacity numbers if possible? (128, 256, 512)
                // Actually, capacity usually matches. 
                // Let's just say: If text similarity is high but numbers are disjoint, REJECT.
                const intersection = pNumbers.filter(n => iNumbers.includes(n));
                if (intersection.length === 0) {
                    isSafe = false;
                    // console.log(`Skipping Number Mismatch: ${p.name} vs ${path.basename(bestMatch.file)}`);
                }
            }

            if (isSafe) {
                matches.push({
                    productId: p.id,
                    productName: p.name,
                    matchedImage: bestMatch.file,
                    confidence: bestMatch.score
                });

                if (bestMatch.score > 0.9) exactMatches++;
                else if (bestMatch.score > 0.7) highConfMatches++;
                else mediumConfMatches++;
            }
        }
    });

    // Save to JSONL
    // Filter for > 0.6 confidence for safety?
    const safeMatches = matches.filter(m => m.confidence > 0.65).sort((a, b) => b.confidence - a.confidence);

    console.log(`\n📊 Results:`);
    console.log(`   Total Scanned: ${unmatchedProducts.length}`);
    console.log(`   Matches Found (>65%): ${safeMatches.length}`);
    console.log(`     - Very High (>90%): ${exactMatches}`);
    console.log(`     - High (70-90%): ${highConfMatches}`);
    console.log(`     - Medium (40-70%): ${mediumConfMatches}`);

    const jsonl = safeMatches.map(m => JSON.stringify({
        productId: m.productId,
        productName: m.productName,
        matchedImageFilename: m.matchedImage,
        confidence: m.confidence
    })).join('\n');

    fs.writeFileSync(OUTPUT_FILE, jsonl);
    console.log(`\n💾 Saved to ${OUTPUT_FILE}`);

    // Preview top matches
    console.log('\n👀 Top 5 Matches:');
    safeMatches.slice(0, 5).forEach(m => {
        console.log(`   ${(m.confidence * 100).toFixed(1)}% : "${m.productName}" -> "${path.basename(m.matchedImage)}"`);
    });
}

run();
