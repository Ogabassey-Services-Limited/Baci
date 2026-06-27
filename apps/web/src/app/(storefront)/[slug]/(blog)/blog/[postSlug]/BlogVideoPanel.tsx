import Image from 'next/image';

type BlogVideoPanelProps = {
  video: {
    thumbnailUrl: string;
    title: string;
    watchUrl: string;
  };
};

export function BlogVideoPanel({ video }: BlogVideoPanelProps) {
  return (
    <section
      aria-labelledby="blog-video-heading"
      className="my-10 rounded-3xl border border-store-border bg-store-background p-4 text-store-background-text shadow-sm md:p-6"
    >
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-store-primary">
            Video
          </p>
          <h2 id="blog-video-heading" className="text-2xl font-bold">
            Watch the related video
          </h2>
        </div>
        <a
          className="rounded-sm text-sm font-semibold text-store-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-primary focus-visible:ring-offset-2 focus-visible:ring-offset-store-background"
          href={video.watchUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open on YouTube
        </a>
      </div>
      <div className="overflow-hidden rounded-2xl border border-store-border bg-store-background-text/10">
        <a
          aria-label={`Open video on YouTube: ${video.title}`}
          className="group relative block aspect-video w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-store-primary"
          href={video.watchUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Image
            alt={`Video thumbnail for ${video.title}`}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            fill
            sizes="(max-width: 768px) 100vw, 960px"
            src={video.thumbnailUrl}
          />
          <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
          <span className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-store-primary text-store-primary-foreground shadow-lg transition-transform group-hover:scale-105">
            <span className="ml-1 h-0 w-0 border-y-[12px] border-l-[20px] border-y-transparent border-l-current" />
          </span>
        </a>
      </div>
    </section>
  );
}
