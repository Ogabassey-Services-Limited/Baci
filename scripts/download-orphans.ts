import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';

const unmatchedFiles = JSON.parse(fs.readFileSync('unmatched_files.json', 'utf-8'));
const downloadDir = 'orphaned_images_full';

if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

// Clean filenames (remove trailing *)
const cleanFiles = unmatchedFiles.map((f: string) => f.replace('*', ''));

console.log(`🚀 Preparing to download ${cleanFiles.length} files...`);

// Create a batch file for scp (faster than individual calls if we can, but scp doesn't support list file directly readily in one go without zip)
// Let's use a loop but parallelize slightly or just sequential for reliability.
// Better: tar them on server and download one archive.

const fileListPath = 'files_to_tar.txt';
fs.writeFileSync(fileListPath, cleanFiles.map((f: string) => `/var/www/cdn/products/${f}`).join('\n'));

console.log(`📝 Created file list. Archiving on server...`);

const remoteCmd = `tar -czf orphaned_images.tar.gz -T - < ${fileListPath}`;
// We need to pipe the file list to ssh. 
// Standard approach: Copy list to server, run tar, download tar.

async function run() {
    // 1. Copy list
    await execPromise(`scp ${fileListPath} bassey@82.29.190.219:/tmp/files_to_tar.txt`);

    // 2. Tar on server (using -T)
    console.log('📦 Archiving on remote server...');
    await execPromise(`ssh bassey@82.29.190.219 "tar -czf /tmp/orphaned_images.tar.gz -T /tmp/files_to_tar.txt"`);

    // 3. Download Tar
    console.log('⬇️ Downloading archive...');
    await execPromise(`scp bassey@82.29.190.219:/tmp/orphaned_images.tar.gz ./orphaned_images.tar.gz`);

    // 4. Extract
    console.log('📂 Extracting...');
    await execPromise(`tar -xzf orphaned_images.tar.gz -C ${downloadDir} --strip-components=4`); // strip /var/www/cdn/products/

    console.log('✅ Done! Files are in ' + downloadDir);
}

function execPromise(cmd: string) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) console.error(stderr);
            console.log(stdout);
            resolve(stdout);
        });
    });
}

run();
