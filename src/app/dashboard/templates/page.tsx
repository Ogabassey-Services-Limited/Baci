import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BUSINESS_TYPES } from '@/config/business-types';
import { getMerchantForUser } from '@/lib/merchant-server';
import { getAllTemplates } from '@/templates/registry';
import { LivePreviewCard, SmallPreviewCard } from './components/template-cards';
import { TemplatesHeader } from './components/templates-header';

export const metadata: Metadata = {
  title: 'Template Gallery | Baci',
  description: 'Browse and preview all available storefront templates',
};

// Force dynamic usage
export const dynamic = 'force-dynamic';

// Map business types to template categories
const BUSINESS_TYPE_TO_CATEGORY: Record<string, string[]> = {
  [BUSINESS_TYPES.FASHION.id]: ['fashion'],
  [BUSINESS_TYPES.ELECTRONICS.id]: ['gadgets'],
  [BUSINESS_TYPES.HOME_GOODS.id]: ['home'],
  [BUSINESS_TYPES.HEALTH_BEAUTY.id]: ['beauty'],
  [BUSINESS_TYPES.HANDMADE.id]: ['general'],
  [BUSINESS_TYPES.FOOD_BEVERAGE.id]: ['food'],
  [BUSINESS_TYPES.HAIR_EXTENSIONS.id]: ['beauty'],
  [BUSINESS_TYPES.PHARMACEUTICALS.id]: ['health'],
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    redirect('/login');
  }

  const templates = getAllTemplates();
  const showAll = searchParams?.showAll === 'true';

  // Determine user's business category
  const userBusinessType = merchant.business_type;
  const targetCategories = userBusinessType
    ? BUSINESS_TYPE_TO_CATEGORY[userBusinessType]
    : [];

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    if (showAll || !userBusinessType || targetCategories?.length === 0)
      return true;
    return targetCategories?.includes(t.category);
  });

  // If no templates match the filter, show all
  const displayTemplates =
    filteredTemplates.length > 0 ? filteredTemplates : templates;
  const isFiltered = Boolean(
    userBusinessType && targetCategories?.length > 0 && !showAll
  );

  // Group templates
  const productionTemplates = displayTemplates.filter(
    (t) => t.status === 'production'
  );
  const betaTemplates = displayTemplates.filter((t) => t.status === 'beta');
  const draftTemplates = displayTemplates.filter((t) => t.status === 'draft');

  return (
    <div className="space-y-6">
      <TemplatesHeader
        businessName={merchant.business_name}
        isFiltered={isFiltered}
        userBusinessType={userBusinessType}
      />

      <div className="space-y-16">
        {displayTemplates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No templates found for this category.
            </p>
            {/* The header handles the toggle, but we can add a simple link/button here too if needed. 
                Since header is sticky/visible, it's fine. */}
          </div>
        )}

        {/* Production Section - Featured */}
        {productionTemplates.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-8 w-1 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <h2 className="text-2xl font-bold">Production Ready</h2>
              <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-medium border border-green-500/20">
                Stable
              </span>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              {productionTemplates.map((template) => (
                <LivePreviewCard key={template.id} template={template} />
              ))}
            </div>
          </section>
        )}

        {/* Beta Section */}
        {betaTemplates.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-8 w-1 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
              <h2 className="text-2xl font-bold">Beta Access</h2>
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium border border-amber-500/20">
                Testing
              </span>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              {betaTemplates.map((template) => (
                <LivePreviewCard key={template.id} template={template} />
              ))}
            </div>
          </section>
        )}

        {/* Draft Section - Grid Layout */}
        {draftTemplates.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-8 w-1 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
              <h2 className="text-2xl font-bold">In Development</h2>
              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 text-xs font-medium border border-purple-500/20">
                Experimental
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {draftTemplates.map((template) => (
                <SmallPreviewCard key={template.id} template={template} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
