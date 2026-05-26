const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ogabassey_pdp_mobile_new.json');
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const audits = data.lighthouseResult?.audits || {};

console.log('==================================================');
console.log('NETWORK REQUESTS AUDIT');
console.log('==================================================');

const networkRequests = audits['network-requests'] || {};
if (networkRequests.details?.items) {
  const items = networkRequests.details.items;
  console.log(`Total Requests: ${items.length}`);

  console.log('\n--- CSS & Document Resources ---');
  items.forEach((item) => {
    const isCss = item.url.includes('.css') || item.mimeType === 'text/css';
    const isDoc =
      item.mimeType === 'text/html' || item.resourceType === 'Document';

    if (isCss || isDoc) {
      const transferKb = (item.transferSize || 0) / 1024;
      const resourceKb = (item.resourceSize || 0) / 1024;
      console.log(`- URL: ${item.url}`);
      console.log(`  Type: ${item.resourceType} | MIME: ${item.mimeType}`);
      console.log(
        `  Transfer: ${transferKb.toFixed(2)} KB | Resource Size: ${resourceKb.toFixed(2)} KB | Latency: ${item.statusCode} status`
      );
    }
  });

  console.log('\n--- Top JS Resources ---');
  items
    .filter((item) => item.resourceType === 'Script')
    .sort((a, b) => b.resourceSize - a.resourceSize)
    .slice(0, 10)
    .forEach((item) => {
      const transferKb = (item.transferSize || 0) / 1024;
      const resourceKb = (item.resourceSize || 0) / 1024;
      console.log(`- URL: ${item.url.substring(0, 100)}...`);
      console.log(
        `  Transfer: ${transferKb.toFixed(2)} KB | Resource Size: ${resourceKb.toFixed(2)} KB`
      );
    });
} else {
  console.log('No network requests details found.');
}
