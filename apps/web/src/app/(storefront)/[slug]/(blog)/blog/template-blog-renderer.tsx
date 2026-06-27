import type { ComponentType } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import type { BlogPostData, TemplateBlogPageProps } from '@/templates/registry';

interface TemplateBlogRendererProps {
  blogSchema: Record<string, unknown>;
  breadcrumbSchema: Record<string, unknown>;
  organizationSchema?: Record<string, unknown>;
  itemListSchema?: Record<string, unknown>;
  BlogComponent: ComponentType<TemplateBlogPageProps>;
  basePath: string;
  blogPosts: BlogPostData[];
  categories: NonNullable<TemplateBlogPageProps['categories']>;
  category?: string;
  searchQuery?: string;
}

export function TemplateBlogRenderer({
  blogSchema,
  breadcrumbSchema,
  organizationSchema,
  itemListSchema,
  BlogComponent,
  basePath,
  blogPosts,
  categories,
  category,
  searchQuery,
}: TemplateBlogRendererProps) {
  return (
    <>
      {organizationSchema && <JsonLd data={organizationSchema} />}
      <JsonLd data={blogSchema} />
      <JsonLd data={breadcrumbSchema} />
      {itemListSchema && <JsonLd data={itemListSchema} />}
      <BlogComponent
        storeSlug={basePath}
        posts={blogPosts}
        categories={categories}
        category={category}
        searchQuery={searchQuery}
      />
    </>
  );
}
