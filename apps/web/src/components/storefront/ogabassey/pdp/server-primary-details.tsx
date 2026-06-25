import { SafeHtml } from '@/components/ui/safe-html';
import type { ProductSpecSection } from '@/components/storefront/ogabassey/types';

interface OgabasseyPdpServerPrimaryDetailsProps {
  description: string;
  detailedSpecs: ProductSpecSection[];
  productName: string;
}

function getRenderableSpecSections(detailedSpecs: ProductSpecSection[]) {
  return detailedSpecs
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.label.trim() && item.value.trim()
      ),
    }))
    .filter((section) => section.items.length > 0);
}

function getSpecHeadingId(category: string, index: number) {
  const normalizedCategory = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `ogabassey-pdp-server-spec-${normalizedCategory || 'section'}-${index}`;
}

export function OgabasseyPdpServerPrimaryDetails({
  description,
  detailedSpecs,
  productName,
}: OgabasseyPdpServerPrimaryDetailsProps) {
  const specSections = getRenderableSpecSections(detailedSpecs);
  const hasDescription = description.trim().length > 0;

  if (!hasDescription && specSections.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={`${productName} overview and specifications`}
      data-ogabassey-pdp-server-details
    >
      {hasDescription ? (
        <div data-ogabassey-pdp-server-details-card>
          <p data-ogabassey-pdp-server-details-eyebrow>
            Product information
          </p>
          <h2 data-ogabassey-pdp-server-details-title>
            {productName} product overview
          </h2>
          <SafeHtml
            html={description}
            headingLevelOffset={1}
            className="ogabassey-pdp-server-details__rich-text"
          />
        </div>
      ) : null}

      {specSections.length > 0 ? (
        <div data-ogabassey-pdp-server-details-card>
          <p data-ogabassey-pdp-server-details-eyebrow>
            Technical details
          </p>
          <h2
            id="ogabassey-pdp-server-specifications-title"
            data-ogabassey-pdp-server-details-title
          >
            Specifications
          </h2>
          <div data-ogabassey-pdp-server-spec-grid>
            {specSections.map((section, index) => {
              const headingId = getSpecHeadingId(section.category, index);

              return (
                <div
                  key={headingId}
                  aria-labelledby={headingId}
                  data-ogabassey-pdp-server-spec-section
                >
                  <h3
                    id={headingId}
                    data-ogabassey-pdp-server-spec-heading
                  >
                    {section.category}
                  </h3>
                  <dl data-ogabassey-pdp-server-spec-list>
                    {section.items.map((item) => (
                      <div
                        key={`${section.category}-${item.label}-${item.value}`}
                        data-ogabassey-pdp-server-spec-row
                      >
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
