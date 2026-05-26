import { pageSpeedShared } from '../apps/web/tools/seo/run-pagespeed.shared';

async function run() {
  const apiKey = 'AIzaSyAJM0txB_2b-bELbqpC90dLa81I9TokgEQ';
  const targetUrl = 'https://ogabassey.com';
  const strategies = ['mobile', 'desktop'] as const;

  console.log(`Starting targeted PageSpeed Insights audit for: ${targetUrl}`);

  for (const strategy of strategies) {
    console.log(`\n==========================================`);
    console.log(`Running audit for ${strategy.toUpperCase()}...`);
    console.log(`==========================================`);

    const psiUrl = pageSpeedShared.buildPsiUrl({
      apiKey,
      strategy,
      targetUrl,
    });

    try {
      const response = await fetch(psiUrl);
      if (!response.ok) {
        throw new Error(
          `PSI failed with status ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as any;

      const categories = data.lighthouseResult?.categories || {};
      const audits = data.lighthouseResult?.audits || {};

      console.log(`\nScores:`);
      console.log(
        `- Performance: ${categories.performance?.score ? Math.round(categories.performance.score * 100) : 'N/A'}/100`
      );
      console.log(
        `- Accessibility: ${categories.accessibility?.score ? Math.round(categories.accessibility.score * 100) : 'N/A'}/100`
      );
      console.log(
        `- Best Practices: ${categories['best-practices']?.score ? Math.round(categories['best-practices'].score * 100) : 'N/A'}/100`
      );
      console.log(
        `- SEO: ${categories.seo?.score ? Math.round(categories.seo.score * 100) : 'N/A'}/100`
      );

      console.log(`\nCore Web Vitals & Metrics:`);
      console.log(
        `- First Contentful Paint (FCP): ${audits['first-contentful-paint']?.displayValue || 'N/A'}`
      );
      console.log(
        `- Largest Contentful Paint (LCP): ${audits['largest-contentful-paint']?.displayValue || 'N/A'}`
      );
      console.log(
        `- Cumulative Layout Shift (CLS): ${audits['cumulative-layout-shift']?.displayValue || 'N/A'}`
      );
      console.log(
        `- Total Blocking Time (TBT): ${audits['total-blocking-time']?.displayValue || 'N/A'}`
      );
      console.log(
        `- Speed Index: ${audits['speed-index']?.displayValue || 'N/A'}`
      );

      // List top opportunities/diagnostics
      console.log(`\nTop Optimization Opportunities:`);
      const opportunities = Object.entries(audits)
        .filter(
          ([_, audit]: any) =>
            audit.details?.type === 'opportunity' &&
            (audit.details.overallSavingsMs > 0 || audit.score < 0.9)
        )
        .map(([key, audit]: any) => ({
          title: audit.title,
          description: audit.description,
          score: audit.score,
          savings: audit.details.overallSavingsMs || 0,
        }))
        .sort((a, b) => b.savings - a.savings);

      if (opportunities.length === 0) {
        console.log(`- None found (excellent!)`);
      } else {
        opportunities.slice(0, 7).forEach((opp) => {
          const savingsText =
            opp.savings > 0 ? ` (Est. Savings: ${opp.savings}ms)` : '';
          console.log(
            `- [Score: ${Math.round(opp.score * 100)}/100] ${opp.title}${savingsText}`
          );
          console.log(`  Description: ${opp.description}`);
        });
      }

      console.log(`\nTop Diagnostics:`);
      const diagnostics = Object.entries(audits)
        .filter(
          ([_, audit]: any) =>
            audit.score !== null &&
            audit.score < 0.9 &&
            audit.details?.type !== 'opportunity'
        )
        .map(([key, audit]: any) => ({
          title: audit.title,
          description: audit.description,
          score: audit.score,
        }))
        .sort((a, b) => a.score - b.score);

      if (diagnostics.length === 0) {
        console.log(`- None found`);
      } else {
        diagnostics.slice(0, 5).forEach((diag) => {
          console.log(
            `- [Score: ${Math.round(diag.score * 100)}/100] ${diag.title}`
          );
          console.log(`  Description: ${diag.description}`);
        });
      }
    } catch (err: any) {
      console.error(`Error running audit for ${strategy}:`, err.message || err);
    }
  }
}

run().catch(console.error);
