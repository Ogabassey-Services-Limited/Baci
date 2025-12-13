import fs from 'fs';
import Fuse from 'fuse.js';

// Load our laptop wishlist (products needing images)
const ourLaptops = JSON.parse(fs.readFileSync('sourcing_wishlist_laptops.json', 'utf-8'));
console.log(`Our inventory: ${ourLaptops.length} laptops needing images`);

// Load HP sitemap images
const hpLaptops = JSON.parse(fs.readFileSync('hp_laptop_images.json', 'utf-8'));
console.log(`HP sitemap: ${hpLaptops.length} laptops with official images\n`);

// Enrich data with synthesized names for matching
// "hp-elitebook-8-g1i-14-inch..." -> "elitebook 840 g11"
const hpSearchable = hpLaptops.map((p: any) => {
    let searchName = p.productSlug.replace(/-/g, ' ');

    // Naming Convention Hack/Fix
    if (p.productSlug.includes('elitebook-8') || p.productSlug.includes('elitebook-ultra')) {
        let series = '';
        if (p.productSlug.includes('14-inch')) series = '840';
        if (p.productSlug.includes('16-inch')) series = '860';
        if (p.productSlug.includes('13-inch')) series = '830';

        let gen = '';
        if (p.productSlug.includes('g1i') || p.productSlug.includes('g1a') || p.productSlug.includes('g1q')) {
            gen = 'g11';
        }

        if (series && gen) {
            searchName += ` elitebook ${series} ${gen}`;
        }
    }

    return {
        ...p,
        searchName
    };
});

// DEBUG: Check if we actually created any 840 G11s
const debug840 = hpSearchable.find(i => i.searchName.includes('840 g11'));
console.log('--- DEBUG ENRICHMENT ---');
if (debug840) {
    console.log(`Found synthed item: ${debug840.productSlug} -> "${debug840.searchName}"`);
} else {
    console.log('❌ CRITICAL: No "840 g11" generated in search names!');
}

const fuse = new Fuse(hpSearchable, {
    keys: ['searchName', 'productSlug'],
    threshold: 0.4,
    includeScore: true
});

// DEBUG: Test Search
const testRes = fuse.search('elitebook 840 g11');
console.log('--- DEBUG SEARCH "elitebook 840 g11" ---');
testRes.slice(0, 3).forEach(r => console.log(`${r.item.productSlug} (score: ${r.score})`));
console.log('----------------------------------------\n');

const matches: any[] = [];
const noMatch: any[] = [];

// Filter to HP only to avoid Dell/Apple noise
const hpOnlyLaptops = ourLaptops.filter((p: any) => p.productName.toLowerCase().startsWith('hp'));
console.log(`Processing ${hpOnlyLaptops.length} HP products (filtered from ${ourLaptops.length})...`);

for (const our of hpOnlyLaptops) {
    // Extract model name for search (e.g., "HP EliteBook 640 G11" -> "elitebook 640 g11")
    let searchTerm = our.productName
        .replace(/\(.*?\)/g, '') // Remove (New), (Used), (i7), (512GB)
        .replace(/HP|Dell|Lenovo|Apple/gi, '') // Remove Brand, keep MacBook/ProBook
        .replace(/Notebook|Laptop|PC|Chromebook|TouchBar|Non-TouchBar|Touch|Non-Touch/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    // Special handling for HP generations "G11" -> "g11" matches fine, but sometimes "Gen 11"

    // Search
    const results = fuse.search(searchTerm);

    // Find first VALID match within top 10
    let bestMatch: any = null;
    let bestScore = 1;

    for (const result of results.slice(0, 10)) {
        const item = result.item;
        const score = result.score || 1;

        // Strict Validation Logic (Inline)
        // 1. Series Check
        const hpSlug = item.productSlug;
        const userSeriesMatch = our.productName.match(/(\d{3,4}|1[34567]\-[\w\d]+)/);
        const userSeries = userSeriesMatch ? userSeriesMatch[0] : '';
        const userSeriesPrefix = userSeries.charAt(0);

        let isValid = false;

        // Case A: Gaming (Victus/Omen)
        if (our.productName.toLowerCase().includes('victus') || our.productName.toLowerCase().includes('omen')) {
            if (hpSlug.includes('victus') || hpSlug.includes('omen')) isValid = true; // Looser check for gaming, rely on Fuse
        }
        // Case B: EliteBook/ProBook
        else if (our.productName.toLowerCase().includes('elitebook') || our.productName.toLowerCase().includes('probook')) {
            // Check Series Compatibility
            // 840 -> 840 OR 8 (14 inch)
            // 860 -> 860 OR 8 (16 inch)

            // 1. Exact number match?
            if (hpSlug.includes(userSeries)) isValid = true;

            // 2. New Naming Convention match?
            if (!isValid && userSeries.length === 3) {
                const sizeDigit = userSeries.charAt(1); // 4 or 6 or 3
                const targetSize = sizeDigit === '4' ? '14-inch' : (sizeDigit === '6' ? '16-inch' : (sizeDigit === '3' ? '13-inch' : ''));

                // If User starts with 8, HP matches 'elitebook-8' AND size matches
                // If User starts with 6, HP matches 'elitebook-6' AND size matches
                // Note: HP slug might involve 'elitebook-ultra' too

                // Check if HP matches prefix (8, 6) or is Ultra
                const hpIsUltra = hpSlug.includes('ultra');
                const hpSeriesNumber = hpSlug.match(/elitebook-(\d)/);
                const hpSeries = hpSeriesNumber ? hpSeriesNumber[1] : '';

                if (targetSize && hpSlug.includes(targetSize)) {
                    if (hpSeries === userSeriesPrefix) isValid = true;
                    if (hpIsUltra && userSeries === '840') isValid = true; // Map Ultra to 800 series? Research says Ultra is premium. Maybe.
                    // Actually, let's trust the Synthesized "searchName" we made earlier.
                    // If the ITEM's searchName contains the User Series (e.g. "840"), it's valid!
                    if (item.searchName.includes(` ${userSeries} `)) isValid = true;
                }
            }
        }

        if (isValid) {
            bestMatch = item;
            bestScore = score;
            break; // Found the best valid match
        }
    }

    // Default to top result if score is excellent (<0.05) and we didn't filter it? No, strict is better.

    if (bestMatch && bestScore < 0.4) {
        const matchData = {
            supabaseId: our.productId,
            ourProductName: our.productName,
            hpProductSlug: bestMatch.productSlug,
            hpProductUrl: bestMatch.productUrl,
            imageUrl: bestMatch.images[0], // Top official image
            matchScore: bestScore
        };

        matches.push(matchData);
        console.log(`✅ "${our.productName}" -> "${bestMatch.productSlug}" (score: ${bestScore.toFixed(3)})`);
    } else {
        console.log(`❌ No match: "${our.productName}"`);
        noMatch.push(our);
    }
}

console.log(`\n📊 Summary:`);
console.log(`✅ Matched: ${matches.length}`);
console.log(`❌ No match: ${noMatch.length}`);

fs.writeFileSync('hp_matched_images.json', JSON.stringify(matches, null, 2));
fs.writeFileSync('hp_unmatched.json', JSON.stringify(noMatch, null, 2));

console.log('\n📄 Saved to hp_matched_images.json');
