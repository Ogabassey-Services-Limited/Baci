import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

// Configuration
const LOCAL_FILE = '/Users/mac/.gemini/antigravity/brain/800c3e78-75e4-44ff-b05c-539ac0a360f2/chip_unlocked_hero_1766743746571.png';
const REMOTE_HOST = 'bassey@82.29.190.219';
const REMOTE_DIR = '/var/www/cdn/blog/2025/12/'; // Target directory
const DEST_FILENAME = 'chip-unlocked-hero.png'; // Clean filename for CDN

async function upload() {
    console.log('🚀 Uploading Hero Image to CDN...');

    try {
        // 1. Create remote directory if it doesn't exist
        console.log(`Step 1: Ensuring remote directory exists: ${REMOTE_DIR}`);
        await execAsync(`ssh ${REMOTE_HOST} "sudo mkdir -p ${REMOTE_DIR}"`);

        // 2. SCP to home folder first (to avoid permission issues)
        const tempRemotePath = `/home/bassey/${DEST_FILENAME}`;
        console.log(`Step 2: SCP to temporary location: ${tempRemotePath}`);
        await execAsync(
            `scp -o BatchMode=yes -o ConnectTimeout=10 "${LOCAL_FILE}" ${REMOTE_HOST}:${tempRemotePath}`
        );

        // 3. Move to final destination with sudo
        console.log(`Step 3: Moving to final destination: ${REMOTE_DIR}${DEST_FILENAME}`);
        await execAsync(
            `ssh ${REMOTE_HOST} "sudo mv ${tempRemotePath} ${REMOTE_DIR}${DEST_FILENAME}"`
        );

        // 4. Fix permissions
        console.log('Step 4: Setting permissions (www-data)');
        await execAsync(
            `ssh ${REMOTE_HOST} "sudo chown www-data:www-data ${REMOTE_DIR}${DEST_FILENAME}"`
        );

        console.log('✅ Upload successful!');
        console.log(`URL: https://cdn.ogabassey.com/blog/2025/12/${DEST_FILENAME}`);

    } catch (err: any) {
        console.error('❌ Upload failed:', err.message);
        if (err.stderr) console.error('Stderr:', err.stderr);
        process.exit(1);
    }
}

upload();
