import fs from 'fs';
import { exec } from 'child_process';

const matches = JSON.parse(fs.readFileSync('migration_map.json', 'utf-8'));

console.log(`🚀 Preparing to rename ${matches.length} files on VPS...`);

let commandList = [];

for (const match of matches) {
    const oldPath = `/var/www/cdn/products/${match.oldFile}`;
    const newPath = `/var/www/cdn/products/${match.supabaseSlug}.webp`; // Treating as webp or keeping ext? 
    // Wait, the old file is .png usually. We should probably just rename extension if we aren't converting.
    // But better to convert to webp if we can. 
    // VPS might have imagemagick.
    // If not, just rename to .png (if source is png) and we update DB to .png.

    // Let's check source extension
    const ext = match.oldFile.split('.').pop();
    const finalNewPath = `/var/www/cdn/products/${match.supabaseSlug}.${ext}`;

    commandList.push(`mv "${oldPath}" "${finalNewPath}"`);
}

// Write to a shell script locally then upload and run
const scriptContent = `#!/bin/bash
cd /var/www/cdn/products
${commandList.join('\n')}
echo "✅ Renamed ${matches.length} files."
`;

fs.writeFileSync('vps_rename_script.sh', scriptContent);

async function run() {
    console.log('📤 Uploading rename script...');
    await execPromise(`scp vps_rename_script.sh bassey@82.29.190.219:/tmp/vps_rename_script.sh`);

    console.log('▶️ Executing script on VPS...');
    await execPromise(`ssh bassey@82.29.190.219 "bash /tmp/vps_rename_script.sh"`);

    console.log('✅ Done!');
}

function execPromise(cmd: string) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            console.log(stdout);
            resolve(stdout);
        });
    });
}

run();
