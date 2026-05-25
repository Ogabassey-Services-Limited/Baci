const fs = require('fs');

const file = 'apps/mobile-admin/app/(admin)/domains/index.tsx';
let content = fs.readFileSync(file, 'utf8');

// The replacement was messed up for domains/index.tsx
content = content.replace(/\.\.\.\(fallbackDomains\.length > 0 && \{ placeholderData: fallbackDomains,\n    staleTime: 1000 \* 60 \* 5,\n  \}\),/, "...(fallbackDomains.length > 0 && { placeholderData: fallbackDomains }),\n    staleTime: 1000 * 60 * 5,");

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed domains/index.tsx');
