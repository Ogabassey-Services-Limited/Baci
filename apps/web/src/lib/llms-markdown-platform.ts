export function buildPlatformHomeMarkdown(origin: string): string {
  return [
    '# Baci',
    '',
    '> Baci is an AI-native commerce platform for merchants. It helps businesses launch storefronts, manage products, process payments, and operate from a unified dashboard.',
    '',
    '## Summary',
    '- Merchant-facing platform for store creation, catalog management, and operations.',
    '- Core platform surfaces: onboarding, pricing, features, login, dashboard, builder.',
    '- Public marketing pages are the best source for positioning and packaging details.',
    '',
    '## Primary Routes',
    `- ${origin}/onboarding`,
    `- ${origin}/pricing`,
    `- ${origin}/features`,
    `- ${origin}/login`,
    `- ${origin}/dashboard`,
    '',
    '## Notes',
    '- `/dashboard` and many `/api/*` routes are authenticated.',
    '- Use `/openapi.json` and `/sitemap.xml` for machine-readable references.',
    '',
  ].join('\n');
}

export function buildPlatformPricingMarkdown(origin: string): string {
  return [
    '# Baci Pricing',
    '',
    '> Pricing summary for the Baci platform.',
    '',
    '## Plans',
    '- Free: NGN 0. Best for testing ideas and small hobby shops. Includes 1 store, up to 10 products, basic storefront, Baci subdomain, and standard support.',
    '- Pro: NGN 5,000 per month. For growing businesses. Includes unlimited products, custom domain, advanced analytics, priority support, marketing tools, and no transaction fees.',
    '- Premium: NGN 15,000 per month. For scaling enterprises. Includes everything in Pro, multiple staff accounts, advanced reports, dedicated account management, API access, and wholesale features.',
    '',
    '## Related Routes',
    `- ${origin}/onboarding`,
    `- ${origin}/contact`,
    '',
  ].join('\n');
}

export function buildPlatformFeaturesMarkdown(origin: string): string {
  return [
    '# Baci Features',
    '',
    '> Feature summary for the Baci platform.',
    '',
    '## Capabilities',
    '- AI-powered store generation: generate structure, copy, and branding from business inputs.',
    '- Smart theming: derive and apply brand colors from uploaded assets.',
    '- Inventory management: manage products, variants, and stock alerts.',
    '- Real-time analytics: track visitors, sales, and conversion performance.',
    '- Mobile-first storefronts: responsive experiences optimized for mobile shoppers.',
    '- Custom domains: connect merchant-owned domains or start with a platform subdomain.',
    '',
    '## Related Routes',
    `- ${origin}/pricing`,
    `- ${origin}/onboarding`,
    '',
  ].join('\n');
}

export function buildPlatformOnboardingMarkdown(origin: string): string {
  return [
    '# Baci Onboarding',
    '',
    '> Onboarding starts the AI-assisted flow for creating a merchant storefront and configuring initial business details.',
    '',
    '## What This Route Does',
    '- Collects merchant and business information.',
    '- Starts the AI-assisted store setup flow.',
    '- Leads into authenticated setup and builder flows.',
    '',
    '## Related Routes',
    `- ${origin}/pricing`,
    `- ${origin}/login`,
    `- ${origin}/dashboard`,
    '',
    '## Notes',
    '- This route leads to stateful account creation and setup actions.',
    '',
  ].join('\n');
}
