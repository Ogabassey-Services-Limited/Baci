import fs from 'fs';

// Load the products with timestamps (pipe-delimited)
// Format: id|name|created_ms|isAvailable|hasImages
const productsRaw = fs.readFileSync('products_full_timestamps.txt', 'utf-8');
const products = productsRaw.trim().split('\n').filter(l => l.length > 0).map(line => {
    const parts = line.split('|');
    return {
        id: Number(parts[0]),
        name: parts[1],
        createdMs: Number(parts[2].split('.')[0]), // e.g., 1755111428336.000000 -> 1755111428336
        isAvailable: parts[3] === 't',
        hasImages: parts[4] === 't'
    };
});

console.log(`✅ Loaded ${products.length} products with hasImages=true`);

// Load the VPS file list
const filesRaw = fs.readFileSync('vps_files.txt', 'utf-8');
const files = filesRaw.trim().split('\n').filter(f => f.startsWith('productImages-'));

console.log(`📁 Found ${files.length} productImages files`);

interface FileMatch {
    file: string;
    fileDate: string;
    productId: number;
    productName: string;
    diffSeconds: number;
}

// Extract timestamps from filenames
const fileMatches: FileMatch[] = [];
const unmatched: string[] = [];

for (const file of files) {
    // productImages-1735100113828.png -> 1735100113828
    const match = file.match(/productImages-(\d+)/);
    if (!match) {
        unmatched.push(file);
        continue;
    }

    const fileTimestamp = Number(match[1]); // Unix ms
    const fileDate = new Date(fileTimestamp);

    // Find products created within 60 minutes of this image upload
    const WINDOW_MS = 60 * 60 * 1000; // 60 minutes
    const candidates = products.filter(p => {
        const diff = Math.abs(p.createdMs - fileTimestamp);
        return diff < WINDOW_MS;
    });

    if (candidates.length > 0) {
        // Best match = closest timestamp
        candidates.sort((a, b) =>
            Math.abs(a.createdMs - fileTimestamp) - Math.abs(b.createdMs - fileTimestamp)
        );

        const best = candidates[0];
        const diffSec = Math.abs(best.createdMs - fileTimestamp) / 1000;

        console.log(`✅ MATCH: "${file}" -> "${best.name}" (${diffSec.toFixed(0)}s diff)`);
        fileMatches.push({
            file,
            fileDate: fileDate.toISOString(),
            productId: best.id,
            productName: best.name,
            diffSeconds: diffSec
        });
    } else {
        // No match within window
        unmatched.push(file);
    }
}

console.log(`\n📊 Summary:`);
console.log(`✅ Matched: ${fileMatches.length}`);
console.log(`❌ Unmatched: ${unmatched.length}`);

// Save results
fs.writeFileSync('timestamp_matches.json', JSON.stringify(fileMatches, null, 2));
fs.writeFileSync('unmatched_files.json', JSON.stringify(unmatched, null, 2));

console.log('\n📄 Saved to timestamp_matches.json and unmatched_files.json');
