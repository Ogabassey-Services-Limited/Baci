const fs = require('fs');
const content = fs.readFileSync('apps/web/src/components/storefront/new-template/footer.tsx', 'utf8');
const newContent = content.replace(/target="_blank"\n\s*className/g, 'target="_blank"\n                rel="noopener noreferrer"\n                className');
fs.writeFileSync('apps/web/src/components/storefront/new-template/footer.tsx', newContent);
