#!/bin/bash
# Comprehensive lint fix script

cd /Users/macbook/Baci-app/Baci

echo "Fixing lint errors..."

# Fix unused parent parameter in product page
sed -i '' 's/parent: ResolvingMetadata/_parent: ResolvingMetadata/g' src/app/\(storefront\)/\[slug\]/products/\[productSlug\]/page.tsx

# Fix admin settings - add fetchSettings to deps
sed -i '' '32s/.*/  }, [fetchSettings]);/' src/app/admin/settings/page.tsx

# Fix unused request parameter in seo-optimizer
sed -i '' 's/export async function GET(request: NextRequest)/export async function GET(_request: NextRequest)/g' src/app/api/ai/seo-optimizer/route.ts

# Fix unused request in customers/segments
sed -i '' 's/export async function DELETE(request: NextRequest)/export async function DELETE(_request: NextRequest)/g' src/app/api/customers/segments/route.ts

# Fix loyalty points - let to const
sed -i '' 's/let loyaltyError/const loyaltyError/g' src/app/api/loyalty/points/route.ts

# Fix unused UpdatePreferencesInput
sed -i '' 's/import { UpdatePreferencesInput }/\/\/ import { UpdatePreferencesInput }/g' src/app/api/notifications/preferences/route.ts

# Fix unused baseUrl in platform events
sed -i '' 's/const baseUrl =/\/\/ const baseUrl =/g' src/app/api/platform/events/route.ts

# Fix unused Button in blog page
sed -i '' 's/import { Button }/\/\/ import { Button }/g' src/app/blog/page.tsx

# Fix unused currencyCode in checkout
sed -i '' 's/const currencyCode =/\/\/ const currencyCode =/g' src/app/checkout/page.tsx

# Fix unused Star in loyalty page
sed -i '' 's/  Star,/  \/\/ Star,/g' src/app/dashboard/loyalty/page.tsx

# Fix unused Megaphone and error in announcement-bar
sed -i '' 's/  Megaphone,/  \/\/ Megaphone,/g' src/app/dashboard/marketing/announcement-bar/page.tsx
sed -i '' 's/} catch (error) {/} catch {/g' src/app/dashboard/marketing/announcement-bar/page.tsx

# Fix unused Link in dashboard page
sed -i '' 's/import Link from/\/\/ import Link from/g' src/app/dashboard/page.tsx

# Fix unused imports in seo page
sed -i '' 's/  Search,/  \/\/ Search,/g' src/app/dashboard/seo/page.tsx
sed -i '' 's/  AlertTriangle,/  \/\/ AlertTriangle,/g' src/app/dashboard/seo/page.tsx
sed -i '' 's/  Wand2,/  \/\/ Wand2,/g' src/app/dashboard/seo/page.tsx
sed -i '' 's/import Image from/\/\/ import Image from/g' src/app/dashboard/seo/page.tsx

# Fix unused Search in demo page
sed -i '' 's/import { Search }/\/\/ import { Search }/g' src/app/demo/page.tsx

# Fix unused Logo in landing page
sed -i '' 's/import { Logo }/\/\/ import { Logo }/g' src/app/page.tsx

# Fix unused StorefrontContent
sed -i '' 's/  StorefrontContent,/  \/\/ StorefrontContent,/g' src/app/storefront/\[slug\]/storefront-client.tsx

# Fix unused routes in header block
sed -i '' 's/import { routes, asRoute }/import { asRoute }/g' src/components/storefront/blocks/header.tsx

# Fix unused cn in newsletter block
sed -i '' 's/import { cn }/\/\/ import { cn }/g' src/components/storefront/blocks/newsletter.tsx

# Fix unused logoText in ogabassey-header
sed -i '' 's/  logoText,/  _logoText,/g' src/components/storefront/blocks/ogabassey-header.tsx

# Fix unused ThemedButton in ogabassey-hero
sed -i '' 's/import { ThemedButton }/\/\/ import { ThemedButton }/g' src/components/storefront/blocks/ogabassey-hero.tsx

# Fix unused imports in ogabassey-utilities
sed -i '' 's/import { cn }/\/\/ import { cn }/g' src/components/storefront/blocks/ogabassey-utilities.tsx
sed -i '' 's/  Phone, Wifi, Laptop, Zap, Trophy,/  \/\/ Phone, Wifi, Laptop, Zap, Trophy,/g' src/components/storefront/blocks/ogabassey-utilities.tsx

# Fix unused showRecentPurchases in social-proof
sed -i '' 's/  showRecentPurchases,/  _showRecentPurchases,/g' src/components/storefront/social-proof.tsx

# Fix unused merchant and services in gadget-custom-template
sed -i '' 's/  const { merchant } =/  const { merchant: _merchant } =/g' src/components/storefront/templates/gadget-custom-template-ogabassey.tsx
sed -i '' 's/  const services =/  const _services =/g' src/components/storefront/templates/gadget-custom-template-ogabassey.tsx

echo "✅ All lint fixes applied!"
