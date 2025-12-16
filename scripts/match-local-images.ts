
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { stringSimilarity } from 'string-similarity-js'; // You might need to install this or implement simple Jaccard index

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SEARCH_DIR = '/Users/mac/Baci-app/Baci/public/website designs/';

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.endsWith('.avif') || file.endsWith('.png') || file.endsWith('.jpg')) {
                arrayOfFiles.push(path.join(dirPath, file));
            }
        }
    });

    return arrayOfFiles;
}

// Simple Jaccard Similarity for fuzzy matching if package not available
function getSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.toLowerCase().split(/[\s-]+/));
    const set2 = new Set(str2.toLowerCase().split(/[\s-]+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
}

async function matchImages() {
    console.log('🔍 Starting Recursive Local Image Match...');

    // 1. Get Missing Image Products
    const { data: missingProducts, error } = await supabase
        .from('products')
        .select('id, name, slug, brand')
        .ilike('brand', 'Samsung')
        .or('images.is.null,images.eq.[]') // Check for null or empty array
        .neq('status', 'archived');

    if (error) throw error;
    console.log(`FOUND ${missingProducts.length} missing image candidates.`);

    // 2. Read Local Files Recursively
    const allFiles = getAllFiles(SEARCH_DIR);
    console.log(`FOUND ${allFiles.length} local files in ${SEARCH_DIR}`);

    const matches: { product: any, file: string, score: number }[] = [];
    const unmatched: any[] = [];

    // 3. Match
    for (const p of missingProducts) {
        let bestMatch = '';
        let bestScore = 0;

        // Normalize product name: remove 'New', 'Used', GB/TB, and brand if redundant
        const normalizedName = p.name
            .replace(/\(.*\)/g, '')
            .replace(/(Brand )?(New|Used|Open Box|Refurbished|Grade [A-C])/gi, '')
            .replace(/\d+GB|\d+TB/gi, '')
            .replace(/Samsung/gi, '') // remove brand to focus on model
            .replace(/Galaxy/gi, '')
            .trim();

        for (const filePath of allFiles) {
            const fileName = path.basename(filePath);
            const normalizedFile = fileName
                .replace(/\.(avif|png|jpg)$/i, '')
                .replace(/[-_]/g, ' ')
                .replace(/Samsung/gi, '')
                .replace(/Galaxy/gi, '')
                .trim();

            // Boost score if file contains key model parts (e.g. "Watch6", "Tab S9")
            let score = getSimilarity(normalizedName, normalizedFile);

            // Simple boosting for exact sequential match of key terms might be needed, 
            // but let's stick to Jaccard for now with cleaned strings.

            if (score > bestScore) {
                bestScore = score;
                bestMatch = filePath;
            }
        }

        if (bestScore > 0.3) { // Lower threshold slightly for cleaned strings
            matches.push({ product: p, file: bestMatch, score: bestScore });
        } else {
            unmatched.push(p);
        }
    }

    console.log(`\n✅ MATCHED: ${matches.length}`);
    console.log(`❌ UNMATCHED: ${unmatched.length}`);

    // report matches
    matches.sort((a, b) => b.score - a.score).forEach(m => {
        console.log(`[${m.score.toFixed(2)}] ${m.product.name}  ->  ${m.file}`);
    });

    // Write to file for review
    fs.writeFileSync('local_image_matches.json', JSON.stringify(matches, null, 2));
}

matchImages().catch(console.error);
