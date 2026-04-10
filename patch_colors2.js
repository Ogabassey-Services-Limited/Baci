const fs = require('fs');
let content = fs.readFileSync(
  'apps/mobile-storefront/app/(tabs)/cart.tsx',
  'utf8'
);

// There is no useTheme hook in storefront, only in admin app as per the prompt. Storefront uses useColorScheme and Colors.
// I will just replace the hardcoded hexes with palette values in cart.tsx

content = content.replace(
  /colorScheme === 'dark' \? 'rgba\(16, 185, 129, 0\.2\)' : '#ECFDF5'/g,
  "colorScheme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : palette.emerald[50]"
);
content = content.replace(
  /colorScheme === 'dark' \? 'rgba\(245, 158, 11, 0\.2\)' : '#FFFBEB'/g,
  "colorScheme === 'dark' ? 'rgba(245, 158, 11, 0.2)' : palette.amber[50]"
);
content = content.replace(
  /colorScheme === 'dark' \? colors\.success : '#047857'/g,
  "colorScheme === 'dark' ? colors.success : palette.emerald[700]"
);
content = content.replace(
  /colorScheme === 'dark' \? colors\.warning : '#B45309'/g,
  "colorScheme === 'dark' ? colors.warning : palette.amber[700]"
);
content = content.replace(
  /colorScheme === 'dark' \? 'rgba\(245, 158, 11, 0\.2\)' : '#FEF3C7'/g,
  "colorScheme === 'dark' ? 'rgba(245, 158, 11, 0.2)' : palette.amber[100]"
);

fs.writeFileSync('apps/mobile-storefront/app/(tabs)/cart.tsx', content, 'utf8');
