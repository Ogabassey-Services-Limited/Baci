const fs = require('fs');
const path = require('path');

async function run() {
  const apiKey =
    process.env.PAGESPEED_INSIGHTS_API_KEY ||
    'AIzaSyAJM0txB_2b-bELbqpC90dLa81I9TokgEQ';
  const targetUrl =
    'https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090';
  const strategy = 'mobile';

  console.log(
    `Starting targeted PageSpeed Insights mobile audit for: ${targetUrl}`
  );

  const psiUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=${strategy}&category=performance&key=${apiKey}`;

  try {
    const response = await fetch(psiUrl);
    if (!response.ok) {
      throw new Error(
        `PSI failed with status ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Save full JSON for inspection
    const outputPath = path.join(__dirname, 'ogabassey_pdp_mobile_new.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Saved full audit JSON to: ${outputPath}`);

    const categories = data.lighthouseResult?.categories || {};
    const audits = data.lighthouseResult?.audits || {};

    console.log(`\n==========================================`);
    console.log(`AUDIT RESULTS FOR MOBILE`);
    console.log(`==========================================`);
    console.log(
      `Performance Score: ${categories.performance?.score ? Math.round(categories.performance.score * 100) : 'N/A'}/100`
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

    console.log(`\nLCP Breakdown:`);
    const lcpBreakdown =
      audits['lcp-breakdown-insight']?.details?.items?.[0]?.items || [];
    if (lcpBreakdown.length > 0) {
      lcpBreakdown.forEach((item) => {
        console.log(
          `- ${item.label || item.subpart}: ${item.duration.toFixed(1)} ms`
        );
      });
    } else {
      console.log(
        `- LCP subpart duration details not found in breakdown insight.`
      );
      // Fallback display from audit details
      console.log(
        `  LCP element selector: ${audits['largest-contentful-paint']?.details?.items?.[0]?.node?.selector || 'N/A'}`
      );
    }

    console.log(`\nLCP Discovery Insight:`);
    const lcpDiscovery =
      audits['lcp-discovery-insight']?.details?.items?.[0]?.items || {};
    Object.entries(lcpDiscovery).forEach(([key, info]) => {
      console.log(`- ${info.label || key}: ${info.value}`);
    });
  } catch (err) {
    console.error(`Error running audit:`, err.message || err);
  }
}

run().catch(console.error);
