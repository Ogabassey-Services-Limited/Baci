const fs = require('fs');
let content = fs.readFileSync(
  'apps/mobile-storefront/app/(tabs)/cart.tsx',
  'utf8'
);

// I should probably use `colors.success` and `colors.warning` with `color` instead of `backgroundColor` for tags to ensure no hardcoded values.
// Or just let it be `backgroundColor: colors.background` since it's already there and is valid.
// But the border colors are success and warning, so the text color should be matching.

content = content.replace(
  /colorScheme === 'dark' \? colors\.success : '#047857'/g,
  'colors.success'
);
content = content.replace(
  /colorScheme === 'dark' \? colors\.warning : '#B45309'/g,
  'colors.warning'
);
content = content.replace(
  /colorScheme === 'dark' \? colors\.success : '#10B981'/g,
  'colors.success'
);
content = content.replace(
  /colorScheme === 'dark' \? colors\.background : '#ECFDF5'/g,
  'colors.background'
);
content = content.replace(
  /colorScheme === 'dark' \? colors\.background : '#FFFBEB'/g,
  'colors.background'
);
content = content.replace(
  /colorScheme === 'dark' \? colors\.background : '#FEF3C7'/g,
  'colors.background'
);
content = content.replace(
  /colorScheme === 'dark' \? colors\.border : 'rgba\(0,0,0,0\.2\)'/g,
  'colors.border'
);

fs.writeFileSync('apps/mobile-storefront/app/(tabs)/cart.tsx', content, 'utf8');
