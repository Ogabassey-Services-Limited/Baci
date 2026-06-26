type BlogVideoPanelProps = {
  video: {
    embedUrl: string;
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
          className="text-sm font-semibold text-store-primary underline underline-offset-4"
          href={video.watchUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open on YouTube
        </a>
      </div>
      <div className="overflow-hidden rounded-2xl border border-store-border bg-store-background-text/10">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="aspect-video h-auto w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          src={video.embedUrl}
          title={video.title}
        />
      </div>
    </section>
  );
}
