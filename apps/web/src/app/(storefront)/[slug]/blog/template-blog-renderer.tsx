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
      <script
        type="application/ld+json"
        /*
          biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
          nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        */
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(blogSchema),
        }}
      />
      <script
        type="application/ld+json"
        /*
          biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
          nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        */
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbSchema),
        }}
      />
      <BlogComponent
        storeSlug={basePath}
        posts={blogPosts}
        categories={categories}
        searchQuery={searchQuery}
      />
    </>
  );
}
