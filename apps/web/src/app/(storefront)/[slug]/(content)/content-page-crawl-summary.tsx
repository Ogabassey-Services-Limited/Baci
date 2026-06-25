type ContentPageCrawlSummaryKind = 'about' | 'contact' | 'faq';

interface ContentPageCrawlSummaryProps {
  kind: ContentPageCrawlSummaryKind;
  merchantName: string;
}

function getSummaryParagraphs(
  kind: ContentPageCrawlSummaryKind,
  merchantName: string
): string[] {
  switch (kind) {
    case 'about':
      return [
        `${merchantName} uses this page to explain the store background, customer promises and the type of electronics support shoppers can expect before placing an order.`,
        'Use the product categories, policy pages and support links together: the about page explains the merchant context, while product pages carry the exact price, variant, condition, warranty and availability details for each item.',
      ];
    case 'contact':
      return [
        `Use this contact page when you need help from ${merchantName} before or after checkout. Support can help with product availability, order status, delivery questions, repair bookings, swap requests, returns and warranty follow-up.`,
        'Include the product name, order number, preferred contact channel and a clear description of the issue where possible. Specific details help support route the request faster and reduce back-and-forth.',
      ];
    case 'faq':
      return [
        `The FAQ page helps ${merchantName} shoppers answer common questions before opening a support ticket. Review the topics for ordering, payments, delivery, returns, warranty, repairs, swaps and product selection.`,
        'If the answer depends on a specific phone, laptop, console or accessory, check the product page first because live listings carry the current price, stock status, condition and variant information.',
      ];
  }
}

export function ContentPageCrawlSummary({
  kind,
  merchantName,
}: ContentPageCrawlSummaryProps) {
  const paragraphs = getSummaryParagraphs(kind, merchantName);

  return (
    <section className="bg-store-background px-4 pb-12 text-store-background-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-store-border bg-store-background-text/5 p-5 text-store-background-text shadow-sm">
        <div className="space-y-3 text-sm leading-6 text-store-background-text/70 sm:text-base sm:leading-7">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
