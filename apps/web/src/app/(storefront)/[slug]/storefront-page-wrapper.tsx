'use client';
import type { MerchantData } from "@/hooks/merchant/types";

import { type ReactNode, useEffect, useState } from 'react';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import type { Product } from '@/lib/products';
import { getTemplate, type TemplateComponents } from '@/templates/registry';

interface StorefrontPageWrapperProps {
  pageName: keyof TemplateComponents;
  fallback?: ReactNode;
  merchant?: Partial<MerchantData>; // We accept merchant prop for initial data
  products?: Product[]; // Added optional products prop
}

// biome-ignore lint/suspicious/noExplicitAny: Template components have varying prop types
type AnyComponentType = React.ComponentType<any>;

/**
 * Module-scope helper so the component body stays free of try/finally
 * (React Compiler cannot lower try statements with finalizers yet).
 */
async function resolveTemplatePageComponent(
  templateId: string,
  pageName: keyof TemplateComponents
): Promise<AnyComponentType | null> {
  const template = getTemplate(templateId);
  if (!template) {
    return null;
  }

  try {
    const components = await template.getComponents();
    return components[pageName] ?? null;
  } catch (error) {
    // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
    console.error(
      'Failed to load',
      pageName,
      'for template',
      templateId,
      ':',
      error
    );
    return null;
  }
}

/**
 * Wrapper that attempts to load a specific page component from the active template.
 * If the template doesn't support the page or isn't set, renders the fallback.
 */
export function StorefrontPageWrapper({
  pageName,
  fallback,
  merchant: initialMerchant,
  products = [], // Default to empty array if not provided
}: StorefrontPageWrapperProps) {
  // Use safe hook to prevent SSR hydration errors when context isn't yet available
  const merchantContext = useMerchantSafe();
  const hookMerchant = merchantContext?.merchant ?? null;
  const hookLoading = merchantContext?.loading ?? true;

  // Use initial merchant if provided (SSR), otherwise fallback to hook
  const merchant = initialMerchant || hookMerchant;
  const loading = !initialMerchant && hookLoading;

  const [TemplateComponent, setTemplateComponent] =
    useState<AnyComponentType | null>(null);
  const [componentLoading, setComponentLoading] = useState(true);

  useEffect(() => {
    // If we're still loading merchant data, wait
    if (loading) return;

    const loadTemplateComponent = async () => {
      if (
        !merchant?.template_id ||
        merchant.template_id === 'default' ||
        merchant.template_id === 'puck'
      ) {
        setComponentLoading(false);
        return;
      }

      const Component = await resolveTemplatePageComponent(
        merchant.template_id,
        pageName
      );
      if (Component) {
        setTemplateComponent(() => Component);
      }
      setComponentLoading(false);
    };

    loadTemplateComponent();
  }, [merchant, loading, pageName]);

  // If loading merchant or template component, show skeleton
  if (loading || componentLoading) {
    return <StorefrontPageSkeleton />;
  }

  // If template component found, render it
  if (TemplateComponent && merchant) {
    return (
      <TemplateComponent
        merchant={merchant}
        storeSlug={merchant.slug}
        products={products}
        isPreview={false}
      />
    );
  }

  // Fallback to default content
  return <>{fallback}</>;
}
