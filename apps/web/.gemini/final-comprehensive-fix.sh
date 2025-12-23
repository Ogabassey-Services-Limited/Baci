#!/bin/bash
# Final comprehensive lint fix - all remaining issues

cd /Users/macbook/Baci-app/Baci

echo "Applying final comprehensive lint fixes..."

# Fix loyalty/points/route.ts - line 122 (let to const)
perl -i -pe 's/^\s*let \{ data: loyalty, error: loyaltyError \}/    const { data: loyalty, error: loyaltyError }/' src/app/api/loyalty/points/route.ts

# Fix notifications/preferences/route.ts - line 4 (comment out unused import)
perl -i -pe 's/^import type \{ UpdatePreferencesInput \}/\/\/ import type { UpdatePreferencesInput }/' src/app/api/notifications/preferences/route.ts

# Fix checkout/page.tsx - line 291 (comment out unused var)
perl -i -pe 's/^\s*const currencyCode =/    \/\/ const currencyCode =/' src/app/checkout/page.tsx

# Fix announcement-bar/page.tsx - line 11 (comment out unused import)
perl -i -pe 's/^  Megaphone,$/  \/\/ Megaphone,/' src/app/dashboard/marketing/announcement-bar/page.tsx

# Fix add-product-form.tsx - line 623 (fix any type)
perl -i -pe 's/: any\)/: { value: string; label: string })/' src/app/dashboard/products/add/add-product-form.tsx

# Fix demo/page.tsx - line 2 and 130
perl -i -pe 's/^import \{ Search \}/\/\/ import { Search }/' src/app/demo/page.tsx
perl -i -pe 's/: any\)/: { name: string; email: string })/' src/app/demo/page.tsx

# Fix storefront-client.tsx - line 45 and 404
perl -i -pe 's/^  StorefrontContent,$/  \/\/ StorefrontContent,/' src/app/storefront/\[slug\]/storefront-client.tsx
perl -i -pe 's/ as any/ as unknown/g' src/app/storefront/\[slug\]/storefront-client.tsx

# Fix ogabassey-header.tsx - line 19
perl -i -pe 's/^  logoText,$/  _logoText,/' src/components/storefront/blocks/ogabassey-header.tsx

# Fix ogabassey-utilities.tsx - line 5
perl -i -pe 's/^  Phone, Wifi, Laptop, Zap, Trophy,$/  \/\/ Phone, Wifi, Laptop, Zap, Trophy,/' src/components/storefront/blocks/ogabassey-utilities.tsx

# Fix social-proof.tsx - line 301
perl -i -pe 's/^  showRecentPurchases,$/  _showRecentPurchases,/' src/components/storefront/social-proof.tsx

echo "✅ All lint fixes applied!"
echo ""
echo "Running final lint check..."
npm run lint 2>&1 | tail -5
