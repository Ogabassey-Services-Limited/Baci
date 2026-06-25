interface BlogDiscoveryPost {
  id: string;
  title: string;
  slug: string;
}

interface BlogDiscoverySectionProps {
  baseUrl: string;
  categories: string[];
  posts: BlogDiscoveryPost[];
}

export function BlogDiscoverySection({
  baseUrl,
  categories,
  posts,
}: BlogDiscoverySectionProps) {
  return (
    <section
      aria-labelledby="blog-discovery-links"
      className="mx-auto mt-8 max-w-[1400px] px-4 md:px-6"
    >
      <div className="rounded-2xl border border-store-background-text/10 bg-store-background p-5">
        <h2
          id="blog-discovery-links"
          className="text-sm font-semibold uppercase tracking-[0.08em] text-store-background-text/70"
        >
          Continue Exploring
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            className="rounded-full border border-store-background-text/15 px-3 py-1.5 text-xs font-medium text-store-background-text/80 transition-colors hover:border-store-primary hover:text-store-primary"
            href={`${baseUrl}/products`}
          >
            All Products
          </a>
          <a
            className="rounded-full border border-store-background-text/15 px-3 py-1.5 text-xs font-medium text-store-background-text/80 transition-colors hover:border-store-primary hover:text-store-primary"
            href={`${baseUrl}/`}
          >
            Home
          </a>
          {categories.slice(0, 12).map((cat) => (
            <a
              key={cat}
              className="rounded-full border border-store-background-text/15 px-3 py-1.5 text-xs font-medium text-store-background-text/80 transition-colors hover:border-store-primary hover:text-store-primary"
              href={`${baseUrl}/blog?category=${encodeURIComponent(cat)}`}
            >
              {cat}
            </a>
          ))}
        </div>

        {posts.length > 0 && (
          <>
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-store-background-text/55">
              Latest Article Links
            </h3>
            <ul className="mt-2 grid gap-1 md:grid-cols-2 lg:grid-cols-3">
              {posts.slice(0, 24).map((post) => (
                <li key={post.id}>
                  <a
                    className="text-xs text-store-primary underline-offset-4 hover:underline"
                    href={`${baseUrl}/blog/${encodeURIComponent(post.slug)}`}
                  >
                    {post.title}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
