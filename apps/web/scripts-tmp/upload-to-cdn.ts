import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

const LOCAL_FILE = 'scripts-tmp/macbook-blog.avif';
const REMOTE_HOST = 'bassey@82.29.190.219';
const TARGET_PATH = '/var/www/cdn/blog/2025/07/';
const DEST_FILENAME =
  'Apple_MacBook-Pro_14-16-inch_10182021_big.jpg.large_2x-1024x1024.avif';

async function upload() {
  console.log('🚀 Uploading to CDN with SUDO...');

  const localBasename = 'macbook-blog.avif'; // Simple name for SCP
  const tmpRemote = `/home/bassey/${localBasename}`;

  try {
    // 1. SCP to home
    console.log(`Step 1: SCP ${LOCAL_FILE} to ${tmpRemote}`);
    await execAsync(
      `scp -o BatchMode=yes -o ConnectTimeout=5 ${LOCAL_FILE} ${REMOTE_HOST}:${tmpRemote}`
    );

    // 2. Create dir
    console.log('Step 2: Creating directory');
    await execAsync(`ssh ${REMOTE_HOST} "sudo mkdir -p ${TARGET_PATH}"`);

    // 3. Move file and rename
    console.log('Step 3: Moving and renaming file');
    const moveCmd = `ssh ${REMOTE_HOST} "sudo mv ${tmpRemote} ${TARGET_PATH}${DEST_FILENAME}"`;
    await execAsync(moveCmd);

    // 4. Fix permissions (optional but good idea, ownership to www-data)
    console.log('Step 4: Fixing permissions');
    await execAsync(
      `ssh ${REMOTE_HOST} "sudo chown www-data:www-data ${TARGET_PATH}${DEST_FILENAME}"`
    );

    console.log('✅ Upload successful!');
  } catch (err) {
    console.error('❌ Upload failed:', err.message);
    process.exit(1);
  }
}

upload();
