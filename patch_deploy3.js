const fs = require('fs');
let yml = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');

// Revert quotes around token and use memory-specified if condition
yml = yml.replace(/--token="\$\{\{ env\.VERCEL_TOKEN \}\}"/g, '--token=${{ env.VERCEL_TOKEN }}');
yml = yml.replace(/--token="\$\{\{ secrets\.VERCEL_TOKEN \}\}"/g, '--token=${{ secrets.VERCEL_TOKEN }}');
yml = yml.replace(/if: env\.VERCEL_TOKEN != ''/g, "if: ${{ env.VERCEL_TOKEN != '' }}");

fs.writeFileSync('.github/workflows/deploy.yml', yml);
