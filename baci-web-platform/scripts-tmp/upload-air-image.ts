import sharp from 'sharp';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

const INPUT_FILE = 'macbook_air_generic.png';
const OUTPUT_FILE = 'macbook-air-generic.avif';
const REMOTE_HOST = 'bassey@82.29.190.219';
const TARGET_PATH = '/var/www/cdn/products/laptops/';

async function process() {
    console.log('🚀 Processing MacBook Air Image...');

    // 1. Convert
    try {
        await sharp(INPUT_FILE)
            .avif({ quality: 65, effort: 5 })
            .toFile(OUTPUT_FILE);
        console.log('✅ Conversion complete.');
    } catch (e) {
        console.error('Conversion failed:', e);
        return;
    }

    // 2. Upload
    const tmpRemote = `/home/bassey/${OUTPUT_FILE}`;
    try {
        console.log(`Step 1: SCP to ${tmpRemote}`);
        await execAsync(`scp -o BatchMode=yes -o ConnectTimeout=5 ${OUTPUT_FILE} ${REMOTE_HOST}:${tmpRemote}`);

        console.log('Step 2: Moving file');
        await execAsync(`ssh ${REMOTE_HOST} "sudo mv ${tmpRemote} ${TARGET_PATH}${OUTPUT_FILE}"`);

        console.log('Step 3: Fixing permissions');
        await execAsync(`ssh ${REMOTE_HOST} "sudo chown www-data:www-data ${TARGET_PATH}${OUTPUT_FILE}"`);

        console.log(`✅ Upload successful: https://cdn.ogabassey.com/products/laptops/${OUTPUT_FILE}`);
    } catch (err) {
        console.error('❌ Upload failed:', err.message);
    }
}

process();
