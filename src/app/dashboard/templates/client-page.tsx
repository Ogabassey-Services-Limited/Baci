'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, Eye, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  getAllTemplates,
  type TemplateDefinition,
  type TemplateStatus,
} from '@/templates/registry';

// Status badge styling
const statusStyles: Record<TemplateStatus, string> = {
  production: 'bg-green-100 text-green-800 hover:bg-green-100',
  beta: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  draft: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
};

// Category badge styling
const categoryStyles: Record<string, string> = {
  gadgets: 'bg-blue-100 text-blue-800',
  fashion: 'bg-pink-100 text-pink-800',
  general: 'bg-slate-100 text-slate-800',
  food: 'bg-orange-100 text-orange-800',
  services: 'bg-purple-100 text-purple-800',
  beauty: 'bg-rose-100 text-rose-800',
};

function _TemplateCard({ template }: { template: TemplateDefinition }) {
  // Count enabled engine features
  const engineFeatures = Object.values(template.engine).filter(Boolean).length;
  const totalFeatures = Object.values(template.engine).length;

  return (
    <Link href={`/template-preview/${template.id}` as Route}>
      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
        {/* Thumbnail placeholder */}
        <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
          {template.thumbnail ? (
            <img
              src={template.thumbnail}
              alt={template.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl font-bold opacity-20">
                  {template.name.charAt(0)}
                </div>
                <div className="text-xs mt-1">No preview</div>
              </div>
            </div>
          )}
          {/* Status badge overlay */}
          <div className="absolute top-2 right-2">
            <Badge className={statusStyles[template.status]}>
              {template.status}
            </Badge>
          </div>
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
              {template.name}
            </CardTitle>
            <Badge
              variant="outline"
              className={
                categoryStyles[template.category] || categoryStyles.general
              }
            >
              {template.category}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">
            {template.description}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>v{template.version}</span>
            <span>
              Engine: {engineFeatures}/{totalFeatures} features
            </span>
          </div>
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {template.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {template.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

import { useState } from 'react';
import { useMerchant } from '@/hooks/use-merchant';
import { BUSINESS_TYPES, type BusinessTypeId } from '@/config/business-types';

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

export default function TemplatesClientPage() {
  const { merchant } = useMerchant();
  const templates = getAllTemplates();
  const [showAll, setShowAll] = useState(false);

  // Determine user's business category
  const userBusinessType = merchant?.business_type;
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
  const isFiltered =
    userBusinessType && targetCategories?.length > 0 && !showAll;

  // Group templates
  const productionTemplates = displayTemplates.filter(
    (t) => t.status === 'production'
  );
  const betaTemplates = displayTemplates.filter((t) => t.status === 'beta');
  const draftTemplates = displayTemplates.filter((t) => t.status === 'draft');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Template Gallery
          </h1>
          <p className="text-muted-foreground">
            {isFiltered
              ? `Recommended templates for your ${merchant?.business_name || 'business'}`
              : 'Explore our collection of premium storefront designs'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {userBusinessType && (
            <Button
              variant={showAll ? 'secondary' : 'default'}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show Recommended Only' : 'Show All Templates'}
            </Button>
          )}
          <Link href="/developers/submit">
            <Button variant="outline">Submit Template</Button>
          </Link>
        </div>
      </div>

      <div className="space-y-16">
        {displayTemplates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No templates found for this category.
            </p>
            <Button variant="link" onClick={() => setShowAll(true)}>
              View all templates
            </Button>
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

// Reusable Apply Template Button
function ApplyTemplateButton({
  templateId,
  size = 'default',
}: {
  templateId: string;
  size?: 'default' | 'sm';
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [isActivating, setIsActivating] = useState(false);

  const { updateMerchant } = useMerchant();

  const handleApply = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsActivating(true);

    try {
      await updateMerchant({ template_id: templateId });

      router.refresh(); // Invalidate server cache to ensure storefront updates

      toast({
        title: 'Template Applied!',
        description: 'Your store is now using this new template.',
      });

      router.push('/dashboard/settings');
    } catch (error) {
      console.error('Template apply error:', error);
      toast({
        title: 'Failed to Apply',
        description:
          error instanceof Error
            ? error.message
            : 'Could not apply template. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <Button
      size={size}
      className="bg-green-600 hover:bg-green-700 text-white"
      onClick={handleApply}
      disabled={isActivating}
    >
      {isActivating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle className="mr-2 h-4 w-4" />
      )}
      {isActivating ? 'Applying...' : 'Apply'}
    </Button>
  );
}

function LivePreviewCard({ template }: { template: TemplateDefinition }) {
  return (
    <div className="group relative bg-card rounded-2xl overflow-hidden border border-border hover:border-purple-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]">
      {/* Browser Chrome */}
      <div className="h-8 bg-muted flex items-center px-4 gap-2 border-b border-border">
        <div className="flex gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        </div>
        <div className="ml-4 h-4 bg-background/50 rounded-full w-40 text-[10px] flex items-center pl-2 text-muted-foreground font-mono">
          baci.store/{template.id}
        </div>
      </div>

      {/* Static Thumbnail Preview - Clickable for preview */}
      <Link href={`/template-preview/${template.id}` as Route}>
        <div className="h-[320px] overflow-hidden relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 cursor-pointer">
          {template.thumbnail ? (
            <img
              src={template.thumbnail}
              alt={`${template.name} preview`}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-8xl font-black opacity-10 select-none">
                  {template.name.charAt(0)}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Click to preview
                </p>
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Info Section with Buttons */}
      <div className="p-6 bg-background">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-xl font-bold">{template.name}</h3>
            <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
              {template.description}
            </p>
          </div>
          <Badge
            variant="outline"
            className="bg-background/5 border-border text-foreground shrink-0 ml-2"
          >
            {template.category}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <ApplyTemplateButton templateId={template.id} />
          <Button variant="outline" size="default" asChild>
            <Link href={`/template-preview/${template.id}` as Route}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Link>
          </Button>
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex gap-2 mt-4">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-secondary px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SmallPreviewCard({ template }: { template: TemplateDefinition }) {
  return (
    <div className="group relative bg-card rounded-xl overflow-hidden border border-border hover:border-ring transition-all hover:-translate-y-1">
      <Link href={`/template-preview/${template.id}` as Route}>
        <div className="aspect-[4/3] bg-muted relative">
          {/* Mini Browser Bar */}
          <div className="absolute top-0 inset-x-0 h-6 bg-black/5 dark:bg-black/20 backdrop-blur flex items-center px-3 z-10">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/20" />
          </div>

          {/* Simplified Preview Content */}
          <div className="h-full w-full flex items-center justify-center text-muted-foreground/20 group-hover:text-muted-foreground/30 transition-colors">
            <div className="text-6xl font-black opacity-20 select-none">
              {template.name.charAt(0)}
            </div>
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-50" />
        </div>
      </Link>

      <div className="p-4">
        <h3 className="font-semibold">{template.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
          {template.description}
        </p>
        <div className="flex gap-2 mt-3">
          <ApplyTemplateButton templateId={template.id} size="sm" />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/template-preview/${template.id}` as Route}>
              <Eye className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
