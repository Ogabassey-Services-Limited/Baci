import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const IMG_DIR = '/Users/mac/Baci-app/Baci/public/website designs';
const OUTPUT_FILE = 'scripts/samsung_fallback_matches.jsonl';

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

// Logic: Attempt to find "Model N-1" or "Same Series"
function findSamsungMatch(productName: string, allImages: string[]): { file: string, method: string } | null {
    const normName = normalize(productName);

    // 1. Extract Model Number (e.g. "A56" -> "56", "S24" -> "24")
    // Regex for specific Samsung patterns
    const aSeries = normName.match(/galaxy a(\d+)/);
    const sSeries = normName.match(/galaxy s(\d+)/);
    const tabSeries = normName.match(/galaxy tab s(\d+)/);
    const zFold = normName.match(/z fold ?(\d+)/);
    const zFlip = normName.match(/z flip ?(\d+)/);

    let targetSeries = '';
    let targetNum = 0;
    let prefix = '';

    if (aSeries) { targetSeries = 'a'; targetNum = parseInt(aSeries[1]); prefix = 'galaxy a'; }
    else if (sSeries) { targetSeries = 's'; targetNum = parseInt(sSeries[1]); prefix = 'galaxy s'; }
    else if (tabSeries) { targetSeries = 'tab s'; targetNum = parseInt(tabSeries[1]); prefix = 'galaxy tab s'; }
    else if (zFold) { targetSeries = 'fold'; targetNum = parseInt(zFold[1]); prefix = 'z fold'; }
    else if (zFlip) { targetSeries = 'flip'; targetNum = parseInt(zFlip[1]); prefix = 'z flip'; }

    if (!targetSeries) return null;

    // Search for images in range [Num, Num-1, Num-2]
    for (let offset = 0; offset <= 2; offset++) {
        const searchNum = targetNum - offset;
        const searchStr = `${prefix}${searchNum}`.toLowerCase(); // e.g. "galaxy a55"

        // Find best image match containing searchStr
        const candidates = allImages.filter(img => normalize(path.basename(img)).includes(searchStr));

        if (candidates.length > 0) {
            // Prioritize "Ultra" if product is Ultra, "FE" if product is FE, etc.
            const isUltra = normName.includes('ultra');
            const isPlus = normName.includes('plus') || normName.includes('+');
            const isFE = normName.includes('fe');

            const best = candidates.sort((a, b) => {
                const aName = normalize(path.basename(a));
                const bName = normalize(path.basename(b));

                let scoreA = 0;
                let scoreB = 0;
                if (isUltra) { if (aName.includes('ultra')) scoreA += 2; if (bName.includes('ultra')) scoreB += 2; }
                if (isPlus) { if (aName.includes('plus') || aName.includes('+')) scoreA += 2; if (bName.includes('plus') || bName.includes('+')) scoreB += 2; }
                if (isFE) { if (aName.includes('fe')) scoreA += 2; if (bName.includes('fe')) scoreB += 2; }

                return scoreB - scoreA;
            })[0];

            return {
                file: best,
                method: offset === 0 ? 'Exact Series' : `Fallback Series -${offset}`
            };
        }
    }

    return null;
}


async function run() {
    console.log('🚀 Starting Samsung Fallback Matching...');

    // 1. Get Unmatched Products (Samsung Only)
    const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, slug, images')
        .ilike('name', '%samsung%');

    const unmatchedProducts = allProducts?.filter(p => !p.images || p.images.length === 0 || p.images[0] === null) || [];
    console.log(`📉 Unmatched Samsung Products: ${unmatchedProducts.length}`);

    // 2. Get All Images
    const allImages = getAllImages(IMG_DIR);

    // 3. Match
    const matches = [];

    unmatchedProducts.forEach(p => {
        const match = findSamsungMatch(p.name, allImages);
        if (match) {
            matches.push({
                productId: p.id,
                productName: p.name,
                matchedImage: match.file,
                confidence: match.method.includes('Fallback') ? 0.8 : 0.95, // High confidence for logic matching
                method: match.method
            });
        }
    });

    console.log(`\n📊 Matches Found: ${matches.length}`);

    // Save
    const jsonl = matches.map(m => JSON.stringify({
        productId: m.productId,
        productName: m.productName,
        matchedImageFilename: m.matchedImage,
        confidence: m.confidence
    })).join('\n');

    fs.writeFileSync(OUTPUT_FILE, jsonl);

    // Preview
    console.log('\n👀 Sample Matches:');
    matches.slice(0, 10).forEach(m => {
        console.log(`   [${m.method}] ${m.productName} -> ${path.basename(m.matchedImage)}`);
    });
}

run();
