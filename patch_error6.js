const fs = require('fs');
const file = 'apps/mobile-storefront/components/ErrorBoundary.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/      const isDark = this\.state\.colorScheme === 'dark';\n      const colors = Colors\[isDark \? 'dark' : 'light'\];/g,
  `      const colors = Colors[this.state.colorScheme === 'dark' ? 'dark' : 'light'];`);

content = content.replace(/  const isDark = colorScheme === 'dark';\n  const colors = Colors\[isDark \? 'dark' : 'light'\];/g,
  `  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];`);

fs.writeFileSync(file, content, 'utf8');
