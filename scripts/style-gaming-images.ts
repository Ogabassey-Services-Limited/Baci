import { Jimp } from 'jimp';
import * as fs from 'fs';
import * as path from 'path';

const RAW_DIR = path.join(process.cwd(), 'gaming_raw_images');
const OUT_DIR = path.join(process.cwd(), 'gaming_branded_images');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

async function styleImages() {
    console.log('Starting Styling Process...');
    const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

    for (const file of files) {
        try {
            console.log(`Processing ${file}...`);
            const image = await Jimp.read(path.join(RAW_DIR, file));

            // 1. Resize to uniform height (e.g. 800px)
            // Maintain aspect ratio
            image.resize({ h: 800 });

            // Save as PNG
            const outName = file.replace(/\.(jpg|jpeg|png)$/i, '.png');
            await image.write(path.join(OUT_DIR, outName));
            console.log(`   Saved ${outName}`);

        } catch (e: any) {
            console.error(`   Failed ${file}:`, e.message);
        }
    }
}

styleImages();
