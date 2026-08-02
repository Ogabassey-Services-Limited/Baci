import Link from 'next/link';
import type { StorefrontSearchReadinessAssessment } from './build-storefront-search-readiness-assessment';

export function StorefrontSearchReadinessCard({
  assessment,
}: {
  assessment: StorefrontSearchReadinessAssessment;
}) {
  const title =
    assessment.tier === 'blocked'
      ? 'Blocked from search indexing'
      : assessment.tier === 'enhanced'
        ? 'Enhanced foundation'
        : 'Indexable foundation';

  return (
    <section aria-labelledby="storefront-search-readiness-title">
      <h2 id="storefront-search-readiness-title">{title}</h2>
      {assessment.findings.length > 0 ? (
        <ul>
          {assessment.findings.map((finding) => (
            <li key={finding.code}>
              <Link href={finding.href}>
                {finding.code.replaceAll('_', ' ')}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No bounded storefront improvements are currently listed.</p>
      )}
    </section>
  );
}
