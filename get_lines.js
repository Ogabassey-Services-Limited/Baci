const fs = require('fs');
let lines = fs.readFileSync('apps/mobile-storefront/components/storefront/FilterBar.tsx', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('styles.promo')) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}
