const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ogabassey_pdp_mobile.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const audits = data.lighthouseResult?.audits || {};

console.log('=== lcp-breakdown-insight ===');
console.log(JSON.stringify(audits['lcp-breakdown-insight'], null, 2));

console.log('\n=== lcp-discovery-insight ===');
console.log(JSON.stringify(audits['lcp-discovery-insight'], null, 2));
