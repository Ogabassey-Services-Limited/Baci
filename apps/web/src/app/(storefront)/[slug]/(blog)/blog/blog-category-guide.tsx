interface CategoryGuideCopyItem {
  id: string;
  text: string;
}

interface CategoryGuideCopy {
  bullets: CategoryGuideCopyItem[];
  heading: string;
  paragraphs: CategoryGuideCopyItem[];
}

function buildGuideCopyItems(
  prefix: string,
  items: string[]
): CategoryGuideCopyItem[] {
  return items.map((text, index) => ({
    id: `${prefix}-${index + 1}`,
    text,
  }));
}

function normalizeCategoryKey(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getOgabasseyCategoryGuideCopy(
  category: string
): CategoryGuideCopy | null {
  const categoryKey = normalizeCategoryKey(category);
  const categoryAliases: Record<string, string> = {
    reviews: 'review',
  };
  const guideKey = categoryAliases[categoryKey] ?? categoryKey;
  const guides: Record<string, CategoryGuideCopy> = {
    deals: {
      heading: 'How to use Ogabassey deals articles',
      paragraphs: buildGuideCopyItems('deals-paragraph', [
        'This archive gathers Ogabassey deals coverage for shoppers comparing phones, laptops, gaming accessories and everyday gadgets in Nigeria. Use it to understand what changed in a promotion, which specifications matter before a discount looks attractive, and when a lower price may still need a warranty, condition or storage check.',
        'The articles are grouped with recent posts first so you can move from offer context to product research quickly. Check the RAM, storage, battery, display, chipset, return terms and delivery details mentioned in each story before selecting a deal.',
      ]),
      bullets: buildGuideCopyItems('deals-bullet', [
        'Compare the discounted price against the exact variant.',
        'Confirm condition, warranty and return terms before checkout.',
        'Use specs and delivery notes to avoid false bargains.',
      ]),
    },
    news: {
      heading: 'How to use Ogabassey news articles',
      paragraphs: buildGuideCopyItems('news-paragraph', [
        'This news archive covers product launches, availability updates, software changes and market signals that can affect electronics buyers in Nigeria. Ogabassey uses these posts to explain why a new phone, laptop, console or accessory matters before it appears as a product listing or comparison option.',
        'Read the latest stories first, then follow the related categories when you need buying context. News articles are most useful when you want release timing, feature changes, official pricing direction, stock expectations or a quick explanation of what has changed since an older model.',
      ]),
      bullets: buildGuideCopyItems('news-bullet', [
        'Track launches and availability before comparing prices.',
        'Use news context to understand model changes and upgrades.',
        'Check related guides when you are ready to buy.',
      ]),
    },
    'platform-comparisons': {
      heading: 'How to use Ogabassey platform comparison articles',
      paragraphs: buildGuideCopyItems('platform-comparisons-paragraph', [
        'Platform comparison articles help shoppers choose between ecosystems before choosing a specific device. Ogabassey uses this category for iOS versus Android decisions, gaming and streaming platform trade-offs, laptop operating-system choices, app support, accessory compatibility and long-term ownership considerations.',
        'Use these articles when the main question is not only price, but which platform fits your workflow, repairs, resale value, updates, payments, cloud services and existing devices. The goal is to make the product shortlist smaller before you compare individual specifications.',
      ]),
      bullets: buildGuideCopyItems('platform-comparisons-bullet', [
        'Compare ecosystems before comparing individual product models.',
        'Review app, accessory and update support for Nigeria.',
        'Use platform fit to narrow your final buying shortlist.',
      ]),
    },
    'product-guides': {
      heading: 'How to use Ogabassey product guide articles',
      paragraphs: buildGuideCopyItems('product-guides-paragraph', [
        'Product guide articles are built for shoppers who need practical buying help before choosing a phone, laptop, console, accessory or repair option. Ogabassey focuses these guides on the details that usually decide value: RAM, storage, chipset, battery life, display quality, camera needs, ports, warranty and after-sales support.',
        'Start here when a product category feels crowded or when two variants look similar. The guides explain which specifications matter for students, creators, gamers, office users and everyday buyers, then point you toward the right category or comparison path.',
      ]),
      bullets: buildGuideCopyItems('product-guides-bullet', [
        'Use guide criteria before sorting only by price.',
        'Match specs to your real use case and budget.',
        'Check variant details before comparing stock listings.',
      ]),
    },
    review: {
      heading: 'How to use Ogabassey review articles',
      paragraphs: buildGuideCopyItems('review-paragraph', [
        'Review articles collect practical impressions, trade-offs and buying notes for electronics shoppers who want more than a spec sheet. Ogabassey uses this category to discuss what a device or accessory is good at, where it may compromise, and which buyer profile should consider it.',
        'Use review posts after you already know the broad category you want. They are designed to help you weigh performance, camera quality, battery endurance, display comfort, build quality, repairability, software support and overall value before moving to a product page.',
      ]),
      bullets: buildGuideCopyItems('review-bullet', [
        'Read reviews after narrowing your category choice.',
        'Look for trade-offs, not only headline specifications.',
        'Compare review notes with the exact variant in stock.',
      ]),
    },
    'smartphone-comparisons': {
      heading: 'How to use Ogabassey smartphone comparison articles',
      paragraphs: buildGuideCopyItems('smartphone-comparisons-paragraph', [
        'Smartphone comparison articles are for buyers deciding between similar phones, storage variants, camera systems, chipsets or brands. Ogabassey uses this category to compare Android and iPhone options, budget and flagship models, battery sizes, display refresh rates, charging speeds and software support.',
        'Use these comparisons when two phones look close on price but differ in everyday experience. The right choice often depends on RAM, storage, network support, camera processing, update policy, repair cost, battery health and whether the exact variant is available in Nigeria.',
      ]),
      bullets: buildGuideCopyItems('smartphone-comparisons-bullet', [
        'Compare exact RAM and storage variants before choosing.',
        'Check battery, display, chipset and camera trade-offs.',
        'Use availability and support notes for Nigeria-specific decisions.',
      ]),
    },
  };

  return guides[guideKey] ?? null;
}

function buildCategoryGuideCopy({
  category,
  isOgabasseyBlogTenant,
  merchantName,
  totalPosts,
}: {
  category: string;
  isOgabasseyBlogTenant: boolean;
  merchantName: string;
  totalPosts: number;
}): CategoryGuideCopy {
  if (isOgabasseyBlogTenant) {
    const guide = getOgabasseyCategoryGuideCopy(category);
    if (guide) {
      return guide;
    }
  }

  const genericGuideKey = normalizeCategoryKey(category) || 'category';

  return {
    heading: `About ${category} articles from ${merchantName}`,
    paragraphs: buildGuideCopyItems(`${genericGuideKey}-paragraph`, [
      `${merchantName} uses this category to organize ${category.toLowerCase()} articles in one place so readers can scan recent updates, compare related topics and move from research to the most relevant store pages without relying on a single short listing view.`,
      `There ${totalPosts === 1 ? 'is' : 'are'} ${totalPosts} ${totalPosts === 1 ? 'article' : 'articles'} in this archive. Use the newest posts first, then review related categories, author pages and product links when you need more context before taking the next step.`,
    ]),
    bullets: buildGuideCopyItems(`${genericGuideKey}-bullet`, [
      'Start with recent posts for the freshest context.',
      'Use related categories to continue the research path.',
      'Check linked products or policies before making a decision.',
    ]),
  };
}

export function BlogCategoryGuide({
  category,
  isOgabasseyBlogTenant = false,
  merchantName,
  totalPosts,
}: {
  category: string;
  isOgabasseyBlogTenant?: boolean;
  merchantName: string;
  totalPosts: number;
}) {
  const guide = buildCategoryGuideCopy({
    category,
    isOgabasseyBlogTenant,
    merchantName,
    totalPosts,
  });

  return (
    <section
      aria-labelledby="blog-category-guide-heading"
      className="mb-8 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm"
    >
      <h2 id="blog-category-guide-heading" className="text-xl font-semibold">
        {guide.heading}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
        {guide.paragraphs.map((paragraph) => (
          <p key={paragraph.id}>{paragraph.text}</p>
        ))}
      </div>
      <ul className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
        {guide.bullets.map((bullet) => (
          <li key={bullet.id} className="rounded-xl bg-muted/50 px-3 py-2">
            {bullet.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
