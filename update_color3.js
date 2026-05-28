const fs = require('fs');
const file = 'apps/mobile-admin/app/(admin)/(tabs)/products.tsx';
let content = fs.readFileSync(file, 'utf8');

// We need a theme color instead of hardcoded hex!
// In constants/theme.ts, gold in DARK is '#F0BF58' (light yellow/gold).
// gold in LIGHT is '#D4A03D' (darker gold).
// Text on gold in light mode needs to be dark or light depending on contrast. '#D4A03D' has low contrast with white, but also low with black. Let's see what is standard.
// If I use `colors.text` on gold? Or is there a textOnPrimary?
// The task prefers "Replace hardcoded colors with colors.* from useTheme() (mobile)"
// In `theme.ts` there is `colors.text` and `colors.background`.
// Maybe I should just use `colors.text`? But wait, the original was `color: '#000000'`.
// I will change it to `colors.text` or maybe `colors.background` for contrast. Or maybe `colors.text` is right since `colors.gold` is a light color.

content = content.replace(
  /\? { color: isDark \? '#000000' : '#FFFFFF', fontFamily: TYPOGRAPHY\.fontFamily\.semiBold }/g,
  "? { color: colors.background, fontFamily: TYPOGRAPHY.fontFamily.semiBold }"
);

fs.writeFileSync(file, content);
console.log('Updated products.tsx again');
