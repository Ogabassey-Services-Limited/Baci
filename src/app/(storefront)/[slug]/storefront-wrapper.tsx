'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { Button } from '@/components/ui/button';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { useMerchant } from '@/hooks/use-merchant';
import { getTemplate } from '@/templates/registry';

const DynamicPuckStorefront = dynamic(
  () =>
    import('@/components/storefront/puck-storefront').then(
      (mod) => mod.PuckStorefront
    ),
  { ssr: false } // Client-side only rendering
);

/**
 * Wrapper that renders the appropriate storefront template based on merchant's template_id.
 * Falls back to Puck storefront if no template_id is set or template not found.
 */
export function StorefrontWrapper() {
  const { merchant, loading } = useMerchant();
  const [showError, setShowError] = useState(false);
  const [TemplateHome, setTemplateHome] = useState<React.ComponentType<{
    storeSlug?: string;
    merchant?: unknown;
    isPreview?: boolean;
  }> | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);

  // Load template components based on merchant's template_id
  useEffect(() => {
    const loadTemplate = async () => {
      if (loading) return;

      const templateId = merchant?.template_id;

      // If no template_id or it's 'default' or 'puck', use Puck storefront
      if (!templateId || templateId === 'default' || templateId === 'puck') {
        setTemplateHome(null);
        setTemplateLoading(false);
        return;
      }

      // Try to load the template from registry
      const template = getTemplate(templateId);
      if (!template) {
        console.warn(
          `Template "${templateId}" not found in registry, falling back to Puck`
        );
        setTemplateHome(null);
        setTemplateLoading(false);
        return;
      }

      try {
        const components = await template.getComponents();
        setTemplateHome(() => components.Home);
        setTemplateLoading(false);
      } catch (error) {
        console.error(`Failed to load template "${templateId}":`, error);
        setTemplateHome(null);
        setTemplateLoading(false);
      }
    };

    loadTemplate();
  }, [merchant?.template_id, loading]);

  // Show loading state
  if (loading || templateLoading) {
    return <StorefrontPageSkeleton />;
  }

  if (showError) {
    return (
      <div
        className="flex flex-col min-h-screen items-center justify-center bg-background text-center px-4"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl mb-4">
          Store Not Set Up
        </h1>
        <p className="max-w-[600px] text-muted-foreground md:text-xl mb-8">
          Your store hasn't been set up yet. Please complete the onboarding
          process or visit the builder to create your store template.
        </p>
        <div className="flex gap-4">
          <Button asChild>
            <Link href="/onboarding">Complete Onboarding</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/builder">Open Builder</Link>
          </Button>
        </div>
      </div>
    );
  }

  // If we have a template component, render it
  if (TemplateHome) {
    return (
      <>
        <AnalyticsProvider />
        <Suspense fallback={<StorefrontPageSkeleton />}>
          <TemplateHome
            storeSlug={merchant?.slug}
            merchant={merchant || undefined}
            isPreview={false}
          />
        </Suspense>
      </>
    );
  }

  // Fall back to Puck storefront
  return (
    <>
      <AnalyticsProvider />
      <DynamicPuckStorefront onNoConfig={() => setShowError(true)} />
    </>
  );
}
