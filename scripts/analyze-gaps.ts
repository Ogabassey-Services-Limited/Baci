import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const IMG_DIR = '/Users/mac/Baci-app/Baci/public/website designs';

async function analyze() {
    console.log('🔍 Analyzing Gaps...');

    // 1. Get all products
    const { data: products } = await supabase
        .from('products')
        .select('id, name, slug, images');

    // 2. Identify Unmatched Products
    const unmatchedProducts = products?.filter(p => !p.images || p.images.length === 0 || p.images[0] === null);
    console.log(`\n📉 Unmatched Products: ${unmatchedProducts?.length} / ${products?.length}`);

    // 3. Get all local images
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

    const allImages = getAllImages(IMG_DIR);
    console.log(`\n📂 Total Local Images: ${allImages.length}`);

    // 4. Identify Used Images (exact filename match from previous runs would be hard to trace exactly without logs, 
    //    but we can look at the deploy logs or just rely on a fuzzy check? 
    //    Actually, let's just dump the unmatched products and all images to a new file for the AI to retry.)

    // Let's filter out images capable of being matched? 
    // No, simpler: Just give the AI the list of Unmatched Products and ALL Images again, 
    // but maybe prompt it differently? "Find ANY plausible match even if weak"?

    // Or better: Let's see if we can find unused images.
    // The previous match file has the matches.

    // Load previous matches
    const matchFiles = [
        'scripts/ai_matches_part1.jsonl',
        'scripts/ai_matches_part2.jsonl',
        'scripts/ai_matches_part3.jsonl'
    ];

    const usedImageFilenames = new Set<string>();

    matchFiles.forEach(f => {
        if (fs.existsSync(f)) {
            const content = fs.readFileSync(f, 'utf-8');
            content.split('\n').forEach(line => {
                if (!line.trim()) return;
                try {
                    const json = JSON.parse(line);
                    if (json.matchedImageFilename) {
                        usedImageFilenames.add(json.matchedImageFilename.split('/').pop()!);
                        // Note: matchedImageFilename in JSONL might be full path or relative. 
                        // Let's check the format.
                    }
                } catch (e) { }
            });
        }
    });

    console.log(`\n🖼️  Used Images (according to logs): ${usedImageFilenames.size}`);

    const unusedImages = allImages.filter(img => !usedImageFilenames.has(path.basename(img)));
    console.log(`\n✨ Unused Images Available: ${unusedImages.length}`);

    // 4. Analyze Unused Images by Brand/Folder
    const brandCounts: Record<string, number> = {};

    unusedImages.forEach(img => {
        const parentDir = path.dirname(img).split('/').pop() || 'Other';
        const filename = path.basename(img).toLowerCase();

        let brand = parentDir;
        if (filename.includes('samsung')) brand = 'Samsung';
        else if (filename.includes('iphone') || filename.includes('apple') || filename.includes('macbook')) brand = 'Apple';
        else if (filename.includes('tecno')) brand = 'Tecno';
        else if (filename.includes('infinix')) brand = 'Infinix';
        else if (filename.includes('ps5') || filename.includes('ps4') || filename.includes('playstation')) brand = 'PlayStation';
        else if (filename.includes('dell')) brand = 'Dell';
        else if (filename.includes('hp')) brand = 'HP';

        brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    });

    console.log('\n📊 Remaining Unused Images by Brand:');
    Object.entries(brandCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([brand, count]) => console.log(`   - ${brand}: ${count}`));

    // Check specific examples
    console.log('\n👀 Sample Unused Images:');
    unusedImages.slice(0, 10).forEach(i => console.log(`   ${path.basename(i)}`));
}

analyze();
