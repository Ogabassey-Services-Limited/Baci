import fs from 'fs';
import { execSafe } from './lib/exec-safe';
import path from 'path';

const unmatchedFiles = JSON.parse(fs.readFileSync('unmatched_files.json', 'utf-8'));
const downloadDir = 'orphaned_images_full';

if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

// Clean filenames (remove all trailing *)
const cleanFiles = unmatchedFiles.map((f: string) => f.replace(/\*$/g, ''));

console.log("🚀 Preparing to download", cleanFiles.length, "files...");

const fileListPath = 'files_to_tar.txt';
fs.writeFileSync(fileListPath, cleanFiles.map((f: string) => `/var/www/cdn/products/${f}`).join('\n'));

console.log(`📝 Created file list. Archiving on server...`);

async function run() {
    // 1. Copy list
    await execSafe('scp', [fileListPath, 'bassey@82.29.190.219:/tmp/files_to_tar.txt']);

    // 2. Tar on server (using -T)
    console.log('📦 Archiving on remote server...');
    await execSafe('ssh', ['bassey@82.29.190.219', 'tar -czf /tmp/orphaned_images.tar.gz -T /tmp/files_to_tar.txt']);

    // 3. Download Tar
    console.log('⬇️ Downloading archive...');
    await execSafe('scp', ['bassey@82.29.190.219:/tmp/orphaned_images.tar.gz', './orphaned_images.tar.gz']);

    // 4. Extract
    console.log('📂 Extracting...');
    await execSafe('tar', ['-xzf', 'orphaned_images.tar.gz', '-C', downloadDir, '--strip-components=4']);

    console.log('✅ Done! Files are in ' + downloadDir);
}

run();
