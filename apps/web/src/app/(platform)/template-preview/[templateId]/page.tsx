import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getAllTemplateIds, TEMPLATE_REGISTRY } from '@/templates/registry';
import { TemplatePreviewClient } from './preview-client';

// Generate static params for all templates
export function generateStaticParams() {
  return getAllTemplateIds().map((templateId) => ({
    templateId,
  }));
}

// Dynamic metadata based on template
export async function generateMetadata({
  params,
}: {
  params: Promise<{ templateId: string }>;
}): Promise<Metadata> {
  const { templateId } = await params;
  const template = TEMPLATE_REGISTRY[templateId];

  if (!template) {
    return {
      title: 'Template Not Found',
    };
  }

  return {
    title: `${template.name} - Template Preview | Baci`,
    description: template.description,
    robots: {
      index: false, // Don't index preview pages
      follow: false,
    },
  };
}

// Loading skeleton
function PreviewSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">Loading template preview...</p>
      </div>
    </div>
  );
}

export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = TEMPLATE_REGISTRY[templateId];

  if (!template) {
    notFound();
  }

  return (
    <Suspense fallback={<PreviewSkeleton />}>
      <TemplatePreviewClient templateId={templateId} />
    </Suspense>
  );
}
