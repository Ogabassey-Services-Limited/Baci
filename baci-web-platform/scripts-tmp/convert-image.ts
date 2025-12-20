import sharp from 'sharp';
import path from 'path';

const INPUT_FILE = 'scripts-tmp/macbook-blog.png';
const OUTPUT_FILE = 'scripts-tmp/macbook-blog.avif';

async function convert() {
    console.log(`Converting ${INPUT_FILE} to ${OUTPUT_FILE}...`);
    try {
        await sharp(INPUT_FILE)
            .avif({ quality: 65, effort: 5 })
            .toFile(OUTPUT_FILE);
        console.log('✅ Conversion complete.');
    } catch (err) {
        console.error('❌ Conversion failed:', err);
        process.exit(1);
    }
}

convert();
