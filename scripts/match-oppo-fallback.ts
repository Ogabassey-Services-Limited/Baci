import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const IMG_DIR = '/Users/mac/Baci-app/Baci/public/website designs';
const OUTPUT_FILE = 'scripts/oppo_matches.jsonl';

function normalize(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getAllImages(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        try {
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getAllImages(filePath));
            } else {
                if (!file.startsWith('.')) results.push(filePath);
            }
        } catch (e) {
            console.warn(`⚠️ Error accessing file ${filePath}:`, e instanceof Error ? e.message : 'Unknown error');
        }
    });
    return results;
}

// Extract series and number
// e.g. "Oppo Reno 14" -> { series: "reno", number: 14 }
// "Oppo A3x" -> { series: "a", number: 3, suffix: "x" }
function parseModel(name: string): { series: string, number: number | null, suffix: string } | null {
    const n = normalize(name);
    if (!n.includes('oppo')) return null;

    if (n.includes('reno')) {
        const match = n.match(/reno\s*(\d+)/);
        return { series: 'reno', number: match ? parseInt(match[1]) : null, suffix: '' };
    }
    if (n.includes(' a') || n.startsWith('a')) { // "Oppo A3" or "A3"
        const match = n.match(/a(\d+)([a-z]*)/); // matches A3, A3x, A58
        if (match) {
            return { series: 'a', number: parseInt(match[1]), suffix: match[2] };
        }
    }
    // Find X, Find N
    if (n.includes('find x')) {
        const match = n.match(/find x(\d+)/);
        return { series: 'find x', number: match ? parseInt(match[1]) : null, suffix: '' };
    }
    return null;
}

async function run() {
    console.log('🚀 Starting Oppo Fallback Matching...');

    // 1. Unmatched Products
    const { data: allProducts } = await supabase.from('products').select('id, name, images').ilike('name', '%oppo%');
    const unmatched = allProducts?.filter(p => !p.images || p.images.length === 0 || p.images[0] === null) || [];
    console.log(`📉 Unmatched Oppo Products: ${unmatched.length}`);

    // 2. All Oppo Images
    const allImages = getAllImages(IMG_DIR).filter(f => f.toLowerCase().includes('oppo'));
    console.log(`📸 Found ${allImages.length} Oppo source images.`);

    // 3. Index Images by Series
    const imageIndex: Record<string, { number: number, file: string }[]> = {};
    allImages.forEach(img => {
        const parsed = parseModel(path.basename(img));
        if (parsed && parsed.number !== null) {
            const key = parsed.series;
            if (!imageIndex[key]) imageIndex[key] = [];
            imageIndex[key].push({ number: parsed.number, file: img });
        }
    });

    const matches = [];

    for (const p of unmatched) {
        const parsed = parseModel(p.name);
        if (!parsed || parsed.number === null) {
            console.log(`   Skipping hard-to-parse: ${p.name}`);
            continue;
        }

        const candidates = imageIndex[parsed.series];
        if (candidates && candidates.length > 0) {
            // Sort by number descending
            candidates.sort((a, b) => b.number - a.number);

            // Find closest available number
            // Ideally same or lower.
            // If Reno 14, and we have Reno 11, take Reno 11 (closest).
            // Logic: Sort by ABS(diff)
            candidates.sort((a, b) => Math.abs(a.number - parsed.number!) - Math.abs(b.number - parsed.number!));

            const best = candidates[0];

            // Allow somewhat loose matching for A-series (A3x -> A16 is weird but better than null)
            // But if difference is HUGE (A96 vs A3), maybe risky.
            // But user wants images.
            matches.push({
                productId: p.id,
                productName: p.name,
                matchedImageFilename: best.file,
                confidence: 0.75
            });
            console.log(`   ✅ Matched: ${p.name} -> ${path.basename(best.file)}`);
        } else {
            console.log(`   ⚠️ No candidates for series [${parsed.series}] for ${p.name}`);
        }
    }

    // Save
    const jsonl = matches.map(m => JSON.stringify(m)).join('\n');
    fs.writeFileSync(OUTPUT_FILE, jsonl);
    console.log(`\n💾 Saved ${matches.length} matches to ${OUTPUT_FILE}`);
}

run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
