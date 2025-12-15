import fs from 'fs';
import { execSafe } from './lib/exec-safe';

const matches = JSON.parse(fs.readFileSync('migration_map.json', 'utf-8'));

console.log(`🚀 Preparing to rename ${matches.length} files on VPS...`);

let commandList = [];

for (const match of matches) {
    const oldPath = `/var/www/cdn/products/${match.oldFile}`;
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
    // SECURITY: Safe - hardcoded VPS host, local file path from controlled JSON
    // execSafe uses spawn with shell:false, preventing command injection
    await execSafe('scp', ['vps_rename_script.sh', 'bassey@82.29.190.219:/tmp/vps_rename_script.sh']);

    console.log('▶️ Executing script on VPS...');
    // SECURITY: Safe - command is a hardcoded path, no user input
    // The script content is generated from controlled JSON data
    await execSafe('ssh', ['bassey@82.29.190.219', 'bash /tmp/vps_rename_script.sh']);

    console.log('✅ Done!');
}

run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
