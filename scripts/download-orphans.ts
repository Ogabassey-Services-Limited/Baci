import fs from 'fs';
import { execSafe } from './lib/exec-safe';
import path from 'path';

const VPS_USER = process.env.VPS_USER || 'bassey';
const VPS_IP = process.env.VPS_IP || '82.29.190.219';
const VPS_PATH = process.env.VPS_PATH || '/var/www/cdn/products';

const unmatchedFiles = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'unmatched_files.json'), 'utf-8'));
const downloadDir = path.join(process.cwd(), 'orphaned_images_full');

if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

// Clean filenames (remove all trailing *)
const cleanFiles = unmatchedFiles.map((f: string) => f.replace(/\*$/g, ''));

console.log(`🚀 Preparing to download ${cleanFiles.length} files...`);

const fileListPath = path.join(process.cwd(), 'files_to_tar.txt');
fs.writeFileSync(fileListPath, cleanFiles.map((f: string) => `${VPS_PATH}/${f}`).join('\n'));

console.log(`📝 Created file list. Archiving on server...`);

async function run() {
    const vpsHost = `${VPS_USER}@${VPS_IP}`;

    // SECURITY: Safe - VPS credentials from env vars (developer-controlled)
    // execSafe uses spawn with shell:false, preventing command injection
    // All file paths are either hardcoded or from controlled JSON data

    // 1. Copy list
    await execSafe('scp', [fileListPath, `${vpsHost}:/tmp/files_to_tar.txt`]);

    // 2. Tar on server (using -T)
    // SECURITY: Safe - command uses hardcoded paths, no user input
    console.log('📦 Archiving on remote server...');
    await execSafe('ssh', [vpsHost, 'tar -czf /tmp/orphaned_images.tar.gz -T /tmp/files_to_tar.txt']);

    // 3. Download Tar
    console.log('⬇️ Downloading archive...');
    const archivePath = path.join(process.cwd(), 'orphaned_images.tar.gz');
    await execSafe('scp', [`${vpsHost}:/tmp/orphaned_images.tar.gz`, archivePath]);

    // 4. Extract
    console.log('📂 Extracting...');
    await execSafe('tar', ['-xzf', archivePath, '-C', downloadDir, '--strip-components=4']);

    console.log('✅ Done! Files are in ' + downloadDir);
}

run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
