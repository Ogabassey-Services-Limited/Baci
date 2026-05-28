const fs = require('fs');
const file = 'apps/mobile-admin/app/(admin)/(tabs)/products.tsx';
let content = fs.readFileSync(file, 'utf8');

// Looking for: isActive ? { color: isDark ? '#000000' : '#FFFFFF', fontFamily: TYPOGRAPHY.fontFamily.semiBold }
content = content.replace(
  /\? { color: isDark \? '#000000' : '#FFFFFF', fontFamily: TYPOGRAPHY\.fontFamily\.semiBold }/g,
  "? { color: isDark ? '#000000' : '#FFFFFF', fontFamily: TYPOGRAPHY.fontFamily.semiBold }"
);

// We need a theme color instead of hardcoded hex!
// Wait, the prompt says: "Replace hardcoded '#000000' text with colors.text" is a favorite fix.
// Wait, the background is `colors.gold`.
// Let's check `DARK_COLORS.gold` and `LIGHT_COLORS.gold` in `theme.ts`
