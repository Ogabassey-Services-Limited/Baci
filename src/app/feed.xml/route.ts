import { Feed } from 'feed';
import { PLATFORM_CONFIG } from '@/config/platform';

export async function GET() {
  const feed = new Feed({
    title: "Baci Blog",
    description: "Insights, updates, and stories for the modern merchant.",
    id: PLATFORM_CONFIG.url,
    link: PLATFORM_CONFIG.url,
    language: "en",
    image: `${PLATFORM_CONFIG.url}/logo.png`,
    favicon: `${PLATFORM_CONFIG.url}/favicon.ico`,
    copyright: `All rights reserved ${new Date().getFullYear()}, ${PLATFORM_CONFIG.name}`,
    updated: new Date(), // In real app, use the latest post date
    generator: "Baci Feed Generator",
    feedLinks: {
      rss2: `${PLATFORM_CONFIG.url}/feed.xml`,
    },
    author: {
      name: PLATFORM_CONFIG.name,
      email: "hello@baci.app",
      link: PLATFORM_CONFIG.url,
    },
  });

  // Placeholder posts - in production, fetch from DB
  const posts = [
    {
      title: 'How AI is Revolutionizing E-commerce in Africa',
      excerpt: 'Discover how artificial intelligence is leveling the playing field for small business owners across the continent.',
      date: new Date('2025-10-24'),
      slug: 'ai-revolutionizing-ecommerce',
      image: `${PLATFORM_CONFIG.url}/blog/ai-ecommerce.jpg`
    },
    {
      title: '5 Tips for Writing Product Descriptions that Sell',
      excerpt: 'Learn the secrets to writing copy that converts visitors into customers, powered by Baci AI.',
      date: new Date('2025-10-18'),
      slug: 'writing-product-descriptions',
      image: `${PLATFORM_CONFIG.url}/blog/copywriting-tips.jpg`
    },
    {
      title: 'Introducing Baci Pro: Advanced Features for Growth',
      excerpt: 'We are excited to launch our new Pro tier, designed to help your business scale faster than ever.',
      date: new Date('2025-10-10'),
      slug: 'introducing-baci-pro',
      image: `${PLATFORM_CONFIG.url}/blog/baci-pro.jpg`
    },
  ];

  posts.forEach((post) => {
    feed.addItem({
      title: post.title,
      id: `${PLATFORM_CONFIG.url}/blog/${post.slug}`,
      link: `${PLATFORM_CONFIG.url}/blog/${post.slug}`,
      description: post.excerpt,
      content: post.excerpt, // In real app, put full HTML content here
      author: [
        {
          name: "Baci Team",
          email: "hello@baci.app",
          link: PLATFORM_CONFIG.url,
        },
      ],
      date: post.date,
      image: post.image,
    });
  });

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Cache for 1 hour (3600s) - content velocity doesn't mean real-time
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
