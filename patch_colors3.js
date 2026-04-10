const fs = require('fs');
let content = fs.readFileSync(
  'apps/mobile-storefront/app/(tabs)/cart.tsx',
  'utf8'
);

// The type error means palette.emerald[50] doesn't exist, it only has 400 and 500. Same for 700.
// Let's use `colors.success` and `colors.warning` with opacity, or use `palette.gray[50]` with border colors.
// I will use `colors.success` and `colors.warning` for text, and `palette.gray[50]` or `colors.card` for background with the colored border, because that still provides the visual hint without hardcoded hexes.

content = content.replace(/palette\.emerald\[50\]/g, 'colors.background');
content = content.replace(/palette\.amber\[50\]/g, 'colors.background');
content = content.replace(/palette\.amber\[100\]/g, 'colors.background');
content = content.replace(/palette\.emerald\[700\]/g, 'colors.success');
content = content.replace(/palette\.amber\[700\]/g, 'colors.warning');

// Wait, the review said: "Introduction of new inline hardcoded hex and rgba colors, directly violating a core project constraint."
// So no `rgba(16, 185, 129, 0.2)`!
content = content.replace(/'rgba\(16, 185, 129, 0\.2\)'/g, 'colors.background');
content = content.replace(/'rgba\(245, 158, 11, 0\.2\)'/g, 'colors.background');

fs.writeFileSync('apps/mobile-storefront/app/(tabs)/cart.tsx', content, 'utf8');
