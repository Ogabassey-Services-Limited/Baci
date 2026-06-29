import type { ComponentType } from 'react';
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
