import AppBody from '@/components/app-body';
import { PlatformHeader } from '@/components/platform/header';
import { PlatformFooter } from '@/components/platform/footer';
import { Metadata } from 'next';
import Link from 'next/link';
// import { Button } from '@/components/ui/button';
import { asRoute } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Blog - Baci',
  description: 'Latest news, updates, and e-commerce tips from Baci.',
};

export default function BlogPage() {
  // Placeholder posts for now
  const posts = [
    {
      title: 'How AI is Revolutionizing E-commerce in Africa',
      excerpt: 'Discover how artificial intelligence is leveling the playing field for small business owners across the continent.',
      date: 'Oct 24, 2025',
      category: 'Industry Trends',
      slug: 'ai-revolutionizing-ecommerce',
    },
    {
      title: '5 Tips for Writing Product Descriptions that Sell',
      excerpt: 'Learn the secrets to writing copy that converts visitors into customers, powered by Baci AI.',
      date: 'Oct 18, 2025',
      category: 'Guides',
      slug: 'writing-product-descriptions',
    },
    {
      title: 'Introducing Baci Pro: Advanced Features for Growth',
      excerpt: 'We are excited to launch our new Pro tier, designed to help your business scale faster than ever.',
      date: 'Oct 10, 2025',
      category: 'Product Updates',
      slug: 'introducing-baci-pro',
    },
  ];

  return (
    <AppBody>
      <div className="flex flex-col min-h-screen bg-background font-sans selection:bg-accent/30">
        <PlatformHeader />
        <main className="flex-1 pt-24 pb-16">
          <section className="container px-4 md:px-6">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                The Baci Blog
              </h1>
              <p className="text-xl text-muted-foreground">
                Insights, updates, and stories for the modern merchant.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {posts.map((post) => (
                <Link key={post.slug} href={asRoute(`/blog/${post.slug}`)} className="group">
                  <article className="flex flex-col h-full border border-border rounded-2xl overflow-hidden bg-card hover:shadow-lg transition-shadow">
                    <div className="aspect-video bg-muted/50 flex items-center justify-center text-muted-foreground">
                      Image Placeholder
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <span className="text-accent font-medium">{post.category}</span>
                        <span>•</span>
                        <span>{post.date}</span>
                      </div>
                      <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-muted-foreground mb-6 flex-1">
                        {post.excerpt}
                      </p>
                      <div className="text-primary font-medium group-hover:underline underline-offset-4">
                        Read more &rarr;
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}