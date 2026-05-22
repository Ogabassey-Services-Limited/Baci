const fs = require('fs');
let content = fs.readFileSync('apps/mobile-storefront/components/storefront/FilterBar.tsx', 'utf8');

// I need to check where `styles.promoBanner` is used in the JSX and replace it.
// Oh wait, `FilterBar.tsx` might not have `promoBanner` in JSX anymore or the regex failed because it was slightly different. Let's find it.
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('styles.promoBanner')) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}
