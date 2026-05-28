const fs = require('fs');
const file = 'apps/mobile-admin/app/(admin)/(tabs)/products.tsx';
let content = fs.readFileSync(file, 'utf8');

// Looking for: isActive ? { color: '#000000', fontFamily: TYPOGRAPHY.fontFamily.semiBold }
content = content.replace(
  /\? { color: '#000000', fontFamily: TYPOGRAPHY.fontFamily.semiBold }/g,
  "? { color: isDark ? '#000000' : '#FFFFFF', fontFamily: TYPOGRAPHY.fontFamily.semiBold }"
);

fs.writeFileSync(file, content);
console.log('Updated products.tsx');
