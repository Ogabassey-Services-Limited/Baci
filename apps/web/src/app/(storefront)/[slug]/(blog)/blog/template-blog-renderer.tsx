import type { ComponentType, ReactNode } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import type { JsonLdScriptData } from '@/lib/json-ld-types';
import type { BlogPostData, TemplateBlogPageProps } from '@/templates/registry';

interface TemplateBlogRendererProps {
  blogSchema: JsonLdScriptData;
  breadcrumbSchema: JsonLdScriptData;
  organizationSchema?: JsonLdScriptData;
  itemListSchema?: JsonLdScriptData;
  BlogComponent: ComponentType<TemplateBlogPageProps>;
  basePath: string;
  blogPosts: BlogPostData[];
  categories: NonNullable<TemplateBlogPageProps['categories']>;
  categoryGuide?: ReactNode;
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
  categoryGuide,
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
      {categoryGuide && (
        <div className="container mx-auto px-4 py-8">{categoryGuide}</div>
      )}
    </>
  );
}
