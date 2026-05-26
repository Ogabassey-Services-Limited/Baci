const fs = require('fs');
const path = require('path');

const fileOld = path.join(__dirname, 'ogabassey_pdp_mobile.json');
const fileNew = path.join(__dirname, 'ogabassey_pdp_mobile_new.json');

const getMetrics = (filePath) => {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const audits = data.lighthouseResult?.audits || {};

  const perfScore = data.lighthouseResult?.categories?.performance?.score * 100;

  const fcp = audits['first-contentful-paint']?.numericValue / 1000;
  const lcp = audits['largest-contentful-paint']?.numericValue / 1000;
  const tbt = audits['total-blocking-time']?.numericValue;
  const cls = audits['cumulative-layout-shift']?.numericValue;

  const lcpBreakdown =
    audits['lcp-breakdown-insight']?.details?.items?.[0]?.items || [];
  const breakdown = {};
  lcpBreakdown.forEach((item) => {
    breakdown[item.subpart] = item.duration;
  });

  return {
    score: perfScore,
    fcp,
    lcp,
    tbt,
    cls,
    breakdown,
  };
};

try {
  const oldMetrics = getMetrics(fileOld);
  const newMetrics = getMetrics(fileNew);

  console.log('==================================================');
  console.log('METRIC COMPARISON (MOBILE PDP)');
  console.log('==================================================');
  console.log(
    `${'Metric'.padEnd(25)} | ${'Baseline (Old)'.padEnd(15)} | ${'Current (New)'.padEnd(15)} | ${'Change'.padEnd(12)}`
  );
  console.log('-'.repeat(75));

  const printRow = (label, valOld, valNew, suffix = '', isMs = false) => {
    const diff = valNew - valOld;
    const diffSign = diff > 0 ? '+' : '';
    const diffStr = diff === 0 ? '0' : `${diffSign}${diff.toFixed(2)}${suffix}`;
    const oldStr = `${valOld.toFixed(2)}${suffix}`;
    const newStr = `${valNew.toFixed(2)}${suffix}`;
    console.log(
      `${label.padEnd(25)} | ${oldStr.padEnd(15)} | ${newStr.padEnd(15)} | ${diffStr.padEnd(12)}`
    );
  };

  printRow('Performance Score', oldMetrics.score, newMetrics.score, '/100');
  printRow('First Contentful Paint', oldMetrics.fcp, newMetrics.fcp, 's');
  printRow('Largest Contentful Paint', oldMetrics.lcp, newMetrics.lcp, 's');
  printRow('Total Blocking Time', oldMetrics.tbt, newMetrics.tbt, 'ms');
  printRow('Cumulative Layout Shift', oldMetrics.cls, newMetrics.cls, '');

  console.log('\n==================================================');
  console.log('LCP SUBPART BREAKDOWN COMPARISON');
  console.log('==================================================');

  const parts = [
    { key: 'timeToFirstByte', label: 'Time to First Byte' },
    { key: 'resourceLoadDelay', label: 'Resource Load Delay' },
    { key: 'resourceLoadDuration', label: 'Resource Load Duration' },
    { key: 'elementRenderDelay', label: 'Element Render Delay' },
  ];

  parts.forEach((p) => {
    const oVal = oldMetrics.breakdown[p.key] || 0;
    const nVal = newMetrics.breakdown[p.key] || 0;
    printRow(p.label, oVal, nVal, 'ms');
  });
} catch (e) {
  console.error('Error comparing metrics:', e);
}
