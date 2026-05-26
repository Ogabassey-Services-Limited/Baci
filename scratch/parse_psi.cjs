const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ogabassey_pdp_mobile.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const getAuditMetric = (key) => {
  return data.lighthouseResult?.audits?.[key] || null;
};

const lcpAudit = getAuditMetric('largest-contentful-paint');
const lcpElement = getAuditMetric('largest-contentful-paint-element');

console.log('=== LCP Audit JSON ===');
console.log(JSON.stringify(lcpAudit, null, 2));

console.log('\n=== LCP Element JSON ===');
console.log(JSON.stringify(lcpElement, null, 2));
