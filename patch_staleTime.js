const fs = require('fs');

const filesToPatch = [
  'apps/mobile-admin/app/(admin)/profile.tsx',
  'apps/mobile-admin/app/(admin)/kyc.tsx',
  'apps/mobile-admin/app/(admin)/notifications.tsx',
  'apps/mobile-admin/app/(admin)/domains/index.tsx',
  'apps/mobile-admin/app/(admin)/shipping.tsx',
  'apps/mobile-admin/app/(admin)/payment-methods.tsx',
  'apps/mobile-admin/app/(admin)/expenses/index.tsx',
  'apps/mobile-admin/app/(admin)/expenses/[id].tsx',
];

for (const file of filesToPatch) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/enabled: (.*?),(\s+})\)/g, "enabled: $1,\n    staleTime: 1000 * 60 * 5,$2)");
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Patched ${file}`);
  } else {
    // try matching just queryFn: ...
    newContent = content.replace(/(queryFn:[\s\S]*?)(,\s+enabled:[^,]*)?,?\s*\}\)/g, (match, p1, p2) => {
      if (match.includes('staleTime')) return match;
      if (p2) {
          return `${p1}${p2},\n    staleTime: 1000 * 60 * 5,\n  })`;
      } else {
          return `${p1},\n    staleTime: 1000 * 60 * 5,\n  })`;
      }
    });
     if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Patched ${file} (fallback)`);
    } else {
      console.log(`No change in ${file}`);
    }
  }
}
