const fs = require('fs');
const file = 'apps/mobile-admin/app/(admin)/(tabs)/products.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\? { color: '#000000', fontFamily: TYPOGRAPHY\.fontFamily\.semiBold }/g,
  "? { color: colors.background, fontFamily: TYPOGRAPHY.fontFamily.semiBold }"
);

fs.writeFileSync(file, content);
console.log('Updated products.tsx correctly');
