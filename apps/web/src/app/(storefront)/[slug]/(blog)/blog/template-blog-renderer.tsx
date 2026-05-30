import type { ComponentType } from 'react';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import type { BlogPostData, TemplateBlogPageProps } from '@/templates/registry';

interface TemplateBlogRendererProps {
  blogSchema: Record<string, unknown>;
  breadcrumbSchema: Record<string, unknown>;
  BlogComponent: ComponentType<TemplateBlogPageProps>;
  basePath: string;
  blogPosts: BlogPostData[];
  categories: NonNullable<TemplateBlogPageProps['categories']>;
  searchQuery?: string;
}

export function TemplateBlogRenderer({
  blogSchema,
  breadcrumbSchema,
  BlogComponent,
  basePath,
  blogPosts,
  categories,
  searchQuery,
}: TemplateBlogRendererProps) {
  return (
    <>
      <script type="application/ld+json">
        {safeJsonLdStringify(blogSchema)}
      </script>
      <script type="application/ld+json">
        {safeJsonLdStringify(breadcrumbSchema)}
      </script>
      <BlogComponent
        storeSlug={basePath}
        posts={blogPosts}
        categories={categories}
        searchQuery={searchQuery}
      />
    </>
  );
}
