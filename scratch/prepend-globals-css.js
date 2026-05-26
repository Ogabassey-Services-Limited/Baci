const fs = require('fs');
const path = require('path');

const files = [
  'apps/web/src/app/demo/page.tsx',
  'apps/web/src/app/contact/page.tsx',
  'apps/web/src/app/track/[trackingNumber]/page.tsx',
  'apps/web/src/app/track/page.tsx',
  'apps/web/src/app/privacy/page.tsx',
  'apps/web/src/app/features/page.tsx',
  'apps/web/src/app/terms/page.tsx',
  'apps/web/src/app/about/page.tsx',
  'apps/web/src/app/blog/page.tsx',
  'apps/web/src/app/blog/[slug]/page.tsx',
  'apps/web/src/app/debug-auth/page.tsx',
  'apps/web/src/app/template-preview/[templateId]/page.tsx',
  'apps/web/src/app/template-preview/page.tsx',
  'apps/web/src/app/invite/[token]/page.tsx',
  'apps/web/src/app/(platform)/delete-account/page.tsx',
  'apps/web/src/app/cart/page.tsx',
  'apps/web/src/app/reset-password/page.tsx',
  'apps/web/src/app/staff/accept/page.tsx',
  'apps/web/src/app/(auth)/verify/page.tsx',
  'apps/web/src/app/(auth)/signup/page.tsx',
  'apps/web/src/app/(auth)/update-password/page.tsx',
  'apps/web/src/app/(auth)/forgot-password/page.tsx',
  'apps/web/src/app/pricing/page.tsx',
  'apps/web/src/app/login/page.tsx',
  'apps/web/src/app/onboarding/page.tsx',
  'apps/web/src/app/developers/submit/page.tsx',
];

files.forEach((fileRelPath) => {
  const filePath = path.resolve(__dirname, '..', fileRelPath);
  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist: ${fileRelPath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Check if it already has globals.css import
  if (content.includes('globals.css')) {
    console.log(`Already has globals.css import: ${fileRelPath}`);
    return;
  }

  const importStr = "import '@/app/globals.css';\n";

  // Check for 'use client'
  const useClientRegex = /^(['"])use client\1;?\s*\r?\n/;
  const match = content.match(useClientRegex);

  if (match) {
    // Insert after 'use client' line
    const insertIndex = match[0].length;
    content =
      content.slice(0, insertIndex) + importStr + content.slice(insertIndex);
  } else {
    // Insert at the very top
    content = importStr + content;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully added globals.css import to: ${fileRelPath}`);
});
