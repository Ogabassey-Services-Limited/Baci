
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

dotenv.config();
const execAsync = util.promisify(exec);

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEMP_DIR = 'temp_images_vps';
const VPS_USER = 'bassey';
const VPS_HOST = '82.29.190.219';
const VPS_PATH = '/var/www/cdn/products';
const CDN_BASE_URL = 'https://cdn.ogabassey.com/products';

const TARGET_MATCHERS = [
    'HP OMEN MAX',
    'SAMSUNG OLED DISPLAY SMART TV'
];

async function downloadImage(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function optimizeToAvif(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .avif({ quality: 80, effort: 5 })
        .toBuffer();
}

async function scpFiles(files: string[]) {
    if (files.length === 0) return;
    const fileArgs = files.map(f => path.join(TEMP_DIR, f)).join(' ');
    const cmd = `scp -o BatchMode=yes -o StrictHostKeyChecking=no ${fileArgs} ${VPS_USER}@${VPS_HOST}:${VPS_PATH}`;
    console.log(`Command: ${cmd}`);
    await execAsync(cmd);
}

async function main() {
    console.log('🚀 Optimizing and Uploading to VPS...');

    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR);
    }

    const updates: { id: string; name: string; filename: string }[] = [];

    for (const matcher of TARGET_MATCHERS) {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, images, slug')
            .eq('status', 'active')
            .ilike('name', `%${matcher}%`);

        if (error || !products) continue;

        for (const p of products) {
            // Logic to pick source image:
            // If we just updated it to supabase, use that.
            // If native source is available (Amazon/Donor), use that.
            // For simplicity, I'll rely on the CURRENT image being valid (which I just set to Supabase).
            // Or I can hardcode my known sources again for safety.

            let sourceUrl = '';
            if (p.name.includes('SAMSUNG') && p.name.includes('TV')) {
                sourceUrl = 'https://images-na.ssl-images-amazon.com/images/P/B0C81SJX5D.01.LZZZZZZZ.jpg';
            } else if (p.images && p.images.length > 0) {
                sourceUrl = p.images[0];
            } else {
                continue;
            }

            console.log(`  Processing ${p.name}...`);
            try {
                const buffer = await downloadImage(sourceUrl);
                const avifBuffer = await optimizeToAvif(buffer);
                const filename = `${p.slug}.avif`; // Cleaner filename for CDN

                fs.writeFileSync(path.join(TEMP_DIR, filename), avifBuffer);
                updates.push({ id: p.id, name: p.name, filename });
                console.log(`    Saved locally as ${filename}`);
            } catch (err) {
                console.error(`    ❌ Error processing ${p.name}:`, err);
            }
        }
    }

    if (updates.length > 0) {
        console.log(`\n📂 Uploading ${updates.length} files to VPS...`);
        try {
            const files = updates.map(u => u.filename);
            await scpFiles(files);
            console.log('    ✅ Upload successful.');

            console.log('\n💾 Updating Database...');
            for (const u of updates) {
                const cdnUrl = `${CDN_BASE_URL}/${u.filename}`;
                const { error } = await supabase
                    .from('products')
                    .update({ images: [cdnUrl] })
                    .eq('id', u.id);

                if (error) console.error(`    ❌ DB Failed for ${u.name}:`, error);
                else console.log(`    ✅ DB Updated: ${u.name} -> ${cdnUrl}`);
            }

        } catch (err) {
            console.error('    ❌ SCP Failed:', err);
        }
    }

    // Cleanup
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

main();
