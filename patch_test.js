const fs = require('fs');
const file = 'apps/web/src/components/storefront/ogabassey/pages/checkout/components/OrderSummarySidebar.test.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/screen\.getByRole\('button', \{ name: '' \}\);/g, "screen.getByRole('switch', { name: 'Use Wallet Credit' });");
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched test');
