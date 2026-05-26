const fs = require('fs');
const file = 'apps/mobile-storefront/components/ErrorBoundary.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("import Colors from '@/constants/Colors';")) {
  content = content.replace(/import \{ createLogger \} from '@\/lib\/logger';/g,
    `import Colors from '@/constants/Colors';\nimport { createLogger } from '@/lib/logger';`);
  fs.writeFileSync(file, content, 'utf8');
}
