import type { ComponentType } from 'react';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
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
      {organizationSchema && (
        <script type="application/ld+json">
          {safeJsonLdStringify(organizationSchema)}
        </script>
      )}
      <script type="application/ld+json">
        {safeJsonLdStringify(blogSchema)}
      </script>
      <script type="application/ld+json">
        {safeJsonLdStringify(breadcrumbSchema)}
      </script>
      {itemListSchema && (
        <script type="application/ld+json">
          {safeJsonLdStringify(itemListSchema)}
        </script>
      )}
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
