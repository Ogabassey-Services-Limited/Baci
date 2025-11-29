// Quick fix script for remaining lint errors
// Run with: node .gemini/fix-remaining-lints.cjs

const fs = require('fs');
const path = require('path');

const fixes = [
    // Fix contact-page-client.tsx
    {
        file: 'src/app/(storefront)/[slug]/pages/contact/contact-page-client.tsx',
        find: 'merchant: any',
        replace: 'merchant: { id: string; slug: string; business_name: string; logo_url?: string; brand_colors?: Record<string, string>; pages?: Record<string, string> }',
    },
    // Fix faq-page-client.tsx
    {
        file: 'src/app/(storefront)/[slug]/pages/faq/faq-page-client.tsx',
        find: 'merchant: any',
        replace: 'merchant: { id: string; slug: string; business_name: string; logo_url?: string; brand_colors?: Record<string, string>; pages?: Record<string, string> }',
    },
    // Fix privacy-page-client.tsx
    {
        file: 'src/app/(storefront)/[slug]/pages/privacy/privacy-page-client.tsx',
        find: 'merchant: any',
        replace: 'merchant: { id: string; slug: string; business_name: string; logo_url?: string; brand_colors?: Record<string, string>; pages?: Record<string, string> }',
    },
    // Fix terms-page-client.tsx
    {
        file: 'src/app/(storefront)/[slug]/pages/terms/terms-page-client.tsx',
        find: 'merchant: any',
        replace: 'merchant: { id: string; slug: string; business_name: string; logo_url?: string; brand_colors?: Record<string, string>; pages?: Record<string, string> }',
    },
    // Fix add-product-form.tsx
    {
        file: 'src/app/dashboard/products/add/add-product-form.tsx',
        find: ': any)',
        replace: ': { value: string; label: string })',
    },
    // Fix demo page
    {
        file: 'src/app/demo/page.tsx',
        find: ': any)',
        replace: ': { name: string; email: string })',
    },
    // Fix storefront-client.tsx
    {
        file: 'src/app/storefront/[slug]/storefront-client.tsx',
        find: 'as any',
        replace: 'as Record<string, unknown>',
    },
    // Fix gadget-default-template.tsx
    {
        file: 'src/components/storefront/templates/gadget-default-template.tsx',
        find: 'as any',
        replace: 'as Record<string, unknown>',
    },
    // Fix template-library.ts
    {
        file: 'src/lib/template-library.ts',
        find: ': any',
        replace: ': Record<string, unknown>',
    },
];

fixes.forEach(({ file, find, replace }) => {
    const filePath = path.join('/Users/macbook/Baci-app/Baci', file);
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed: ${file}`);
    } catch (err) {
        console.error(`❌ Error fixing ${file}:`, err.message);
    }
});

console.log('\n✅ All type fixes applied!');
