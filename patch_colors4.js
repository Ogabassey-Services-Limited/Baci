const fs = require('fs');
let content = fs.readFileSync(
  'apps/mobile-storefront/app/(tabs)/cart.tsx',
  'utf8'
);

// The review stated: "Introduction of new inline hardcoded hex and rgba colors, directly violating a core project constraint."
// It means NO `rgba(...)` should be in the file at all if possible, or only use predefined ones.
// Looking at the remaining ones:
// 609: `colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)'` -> `colors.border`
content = content.replace(
  /colorScheme === 'dark' \? 'rgba\(255,255,255,0\.1\)' : 'rgba\(0,0,0,0\.2\)'/g,
  'colors.border'
);

// 1073 and 1130: `backgroundColor: 'rgba(255,255,255,0.4)'` -> This was originally there, but we should fix it if possible. It is used for `checkoutBtnDot` and `checkoutDot`.
// Wait, is it better to just leave the original ones? "Introduction of *new* inline hardcoded hex and rgba..." means I shouldn't add new ones. I added the ones on 609, 359, 360, 509, etc.
// The review specifically called out `#ECFDF5, rgba(16, 185, 129, 0.2), #10B981, and #FEF3C7`.

// I will just use `colors.border` on 609.
// And for conditionTagNew, conditionTagUsed, negotiatedBadge, warningIconCircle, it looks like they are now using `colors.background` for background, which avoids the hardcoded color issue.

// Wait, the review also flagged `colorScheme` as an undeclared variable. "The patch uses a variable colorScheme (colorScheme === 'dark') which is not declared in the visible scope".
// Actually it IS declared on line 65: `const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';`
// But maybe I should just use `colors` unconditionally since `colors` comes from `Colors[colorScheme]`.

content = content.replace(
  /colorScheme === 'dark' \? colors.success : colors.success/g,
  'colors.success'
);
content = content.replace(
  /colorScheme === 'dark' \? colors.warning : colors.warning/g,
  'colors.warning'
);
content = content.replace(
  /colorScheme === 'dark' \? colors.background : colors.background/g,
  'colors.background'
);

fs.writeFileSync('apps/mobile-storefront/app/(tabs)/cart.tsx', content, 'utf8');
