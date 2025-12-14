import fs from 'fs';
import { execSafe } from './lib/exec-safe';
import path from 'path';

const matches = JSON.parse(fs.readFileSync('hp_matched_images.json', 'utf-8'));
const outputDir = 'hp_downloaded_images';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

console.log(`🚀 Downloading ${matches.length} official HP images...`);

async function downloadAndBrand() {
    for (const match of matches) {
        const imageUrl = match.imageUrl;
        const ext = imageUrl.includes('.jpg') ? 'jpg' : 'png';
        const filename = `${match.supabaseId}.${ext}`;
        const outputPath = path.join(outputDir, filename);

        console.log(`\n⬇️ Downloading: ${match.ourProductName}`);
        console.log(`   URL: ${imageUrl}`);

        try {
            // Download
            await execSafe('curl', ['-s', imageUrl, '-o', outputPath]);
            console.log(`   ✅ Downloaded to ${outputPath}`);

            // Apply branding
            const brandedPath = path.join(outputDir, `branded_${filename}`);
            await execSafe('npx', ['tsx', 'scripts/apply-red-ring.ts', outputPath, brandedPath]);
            console.log(`   ✅ Branded: ${brandedPath}`);

        } catch (err) {
            console.error(`   ❌ Failed: ${err}`);
        }
    }

    console.log(`\n✅ Done! Downloaded and branded ${matches.length} images.`);
}

downloadAndBrand();
