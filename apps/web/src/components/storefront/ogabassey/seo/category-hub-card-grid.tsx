import type { CategoryHubCard } from '@/lib/storefront-category/category-hub-types';

interface CategoryHubCardGridProps {
  title: string;
  cards: CategoryHubCard[];
}

function buildHeadingId(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function CategoryHubCardGrid({
  title,
  cards,
}: CategoryHubCardGridProps) {
  if (cards.length === 0) {
    return null;
  }

  const headingId = buildHeadingId(title);

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-3xl border border-store-background-text/10 bg-store-background p-5 md:p-6"
    >
      <h3
        id={headingId}
        className="text-lg font-semibold text-store-background-text"
      >
        {title}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.href}
            className="flex h-full flex-col rounded-2xl border border-store-background-text/10 p-4"
          >
            {card.eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-store-primary">
                {card.eyebrow}
              </p>
            ) : null}
            <h4 className="mt-2 text-base font-semibold text-store-background-text">
              <a
                href={card.href}
                className="underline-offset-4 hover:underline"
              >
                {card.title}
              </a>
            </h4>
            <p className="mt-2 text-sm leading-6 text-store-background-text/70">
              {card.description}
            </p>
            {card.secondaryHref && card.secondaryLabel ? (
              <div className="mt-4">
                <a
                  href={card.secondaryHref}
                  className="text-sm font-semibold text-store-primary underline-offset-4 hover:underline"
                >
                  {card.secondaryLabel}
                </a>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
