import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogAuthorBySlug } from '@/lib/blog-authors';
import { getCachedBlogAuthor } from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { generateBreadcrumbSchema } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { isDomainIdentifier } from '@/lib/validation';

interface BlogAuthorPageContentProps {
  params: Promise<{ slug: string; authorSlug: string }>;
}

function labelForProfileUrl(url: string): string {
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('x.com') || url.includes('twitter.com')) return 'X';
  if (url.includes('youtube.com')) return 'YouTube';
  if (url.includes('tiktok.com')) return 'TikTok';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Profile';
  }
}

export async function BlogAuthorPageContent({
  params,
}: BlogAuthorPageContentProps) {
  const { slug, authorSlug } = await params;

  const profile = getBlogAuthorBySlug(authorSlug, slug);
  if (!profile) {
    notFound();
  }

  const data = await getCachedBlogAuthor(slug, profile.name);
  if (!data) {
    notFound();
  }

  const { merchant, author, posts } = data;
  const baseUrl = buildStoreUrl(merchant);
  const basePath = isDomainIdentifier(slug) ? '' : `/${slug}`;
  const authorPageUrl = `${baseUrl}/blog/author/${authorSlug}`;
  const personId = `${baseUrl}#author-${authorSlug}`;
  const { sameAs } = profile;

  const profilePageSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': authorPageUrl,
    url: authorPageUrl,
    mainEntity: {
      '@type': 'Person',
      '@id': personId,
      name: author.name,
      url: authorPageUrl,
      ...(author.title ? { jobTitle: author.title } : {}),
      ...(author.bio ? { description: author.bio } : {}),
      ...(author.imageUrl ? { image: author.imageUrl } : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
      worksFor: {
        '@type': 'Organization',
        name: merchant.business_name,
        url: baseUrl,
      },
    },
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: merchant.business_name, url: baseUrl },
    { name: 'Blog', url: `${baseUrl}/blog` },
    { name: author.name, url: authorPageUrl },
  ]);

  const itemListSchema =
    posts.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `Articles by ${author.name}`,
          numberOfItems: posts.length,
          itemListElement: posts.map((post, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `${baseUrl}/blog/${post.slug}`,
            name: post.title,
          })),
        }
      : null;

  return (
    <>
      <script type="application/ld+json">
        {safeJsonLdStringify(profilePageSchema)}
      </script>
      <script type="application/ld+json">
        {safeJsonLdStringify(breadcrumbSchema)}
      </script>
      {itemListSchema && (
        <script type="application/ld+json">
          {safeJsonLdStringify(itemListSchema)}
        </script>
      )}

      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Link
              href={asRoute(`${basePath}/blog`)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to Blog
            </Link>
          </div>
        </div>

        <main className="container mx-auto max-w-4xl px-4 py-10">
          <header className="mb-10 flex flex-col items-center gap-4 text-center">
            {author.imageUrl && (
              <Image
                src={author.imageUrl}
                alt={author.name}
                width={120}
                height={120}
                className="size-30 rounded-full object-cover"
                sizes="120px"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold">{author.name}</h1>
              {author.title && (
                <p className="mt-1 text-muted-foreground">
                  {author.title} at {merchant.business_name}
                </p>
              )}
            </div>
            {author.bio && (
              <p className="max-w-2xl text-muted-foreground">{author.bio}</p>
            )}
            {sameAs.length > 0 && (
              <ul className="flex flex-wrap items-center justify-center gap-3">
                {sameAs.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="me noopener noreferrer"
                      className="rounded-full border border-border px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {labelForProfileUrl(url)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </header>

          <h2 className="mb-4 text-xl font-semibold">
            Latest articles by {author.name}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={asRoute(`${basePath}/blog/${post.slug}`)}
                  className="block h-full rounded-xl border border-border p-4 transition-colors hover:bg-muted"
                >
                  {post.featured_image_url && (
                    <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={post.featured_image_url}
                        alt={post.featured_image_alt || post.title}
                        width={400}
                        height={225}
                        className="size-full object-cover"
                        sizes="(max-width: 640px) 100vw, 400px"
                      />
                    </div>
                  )}
                  <h3 className="font-semibold leading-snug">{post.title}</h3>
                  {post.excerpt && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {post.excerpt}
                    </p>
                  )}
                  <time
                    dateTime={post.published_at}
                    className="mt-2 block text-xs text-muted-foreground"
                  >
                    {new Date(post.published_at).toLocaleDateString('en-NG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </>
  );
}
