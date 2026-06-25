import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { asRoute, joinRouteBasePath } from '@/lib/routes';
import type { BlogPostData } from '@/templates/registry';

interface BlogFeaturedStoryProps {
  basePath: string;
  featuredPost: BlogPostData;
  imageSrc: string;
  publishedDateLabel: string;
}

function blogPostHref(basePath: string, slug: string): string {
  return joinRouteBasePath(basePath, `/blog/${slug}`);
}

export function BlogFeaturedStory({
  basePath,
  featuredPost,
  imageSrc,
  publishedDateLabel,
}: BlogFeaturedStoryProps) {
  return (
    <Link
      href={asRoute(blogPostHref(basePath, featuredPost.slug))}
      className="group relative mb-12 block h-[400px] overflow-hidden rounded-4xl shadow-2xl transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.15)] md:h-[500px]"
    >
      <div className="absolute inset-0 bg-store-background-text">
        <Image
          src={imageSrc}
          alt=""
          className="object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
          fill
          fetchPriority="high"
          loading="eager"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-t from-store-background-text via-store-background-text/20 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 w-full p-8 md:w-3/4 md:p-12 lg:w-2/3">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded bg-store-primary px-3 py-1.5 font-black text-[10px] text-store-primary-text uppercase tracking-widest shadow-sm md:text-xs">
            Featured Story
          </span>
          {featuredPost.category && (
            <span className="rounded border border-store-primary-text/20 px-2 py-1 font-bold text-store-primary-text/80 text-xs uppercase tracking-wider backdrop-blur-xs">
              {featuredPost.category}
            </span>
          )}
        </div>
        <h2 className="mb-4 font-black text-3xl text-store-primary-text leading-none transition-colors group-hover:text-store-primary md:text-5xl lg:text-6xl">
          {featuredPost.title}
        </h2>
        <p className="mb-6 max-w-2xl text-store-primary-text/80 text-lg leading-relaxed line-clamp-2 md:text-xl">
          {featuredPost.excerpt}
        </p>
        <div className="flex items-center gap-4 font-medium text-store-primary-text">
          <span className="flex items-center gap-2 border-store-primary-text/30 border-b pb-0.5 transition-all duration-300 group-hover:gap-4 group-hover:border-store-primary-text">
            Read Article <ArrowRight size={20} />
          </span>
          <span className="text-store-primary-text/40">•</span>
          <time className="text-sm text-store-primary-text/80" dateTime={featuredPost.published_at}>
            {publishedDateLabel}
          </time>
        </div>
      </div>
    </Link>
  );
}
