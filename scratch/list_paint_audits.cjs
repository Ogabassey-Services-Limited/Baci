const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ogabassey_pdp_mobile.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const audits = data.lighthouseResult?.audits || {};
const keys = Object.keys(audits).filter(
  (k) =>
    k.includes('paint') ||
    k.includes('lcp') ||
    k.includes('largest') ||
    k.includes('element')
);

console.log('Audits matching keywords:', keys);
keys.forEach((k) => {
  console.log(
    `- ${k}: title="${audits[k].title}", displayValue="${audits[k].displayValue}", hasDetails=${!!audits[k].details}`
  );
});
