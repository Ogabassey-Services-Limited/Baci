const fs = require('fs');
const content = fs.readFileSync('apps/web/src/components/analytics/draggable-analytics-grid.tsx', 'utf-8');

const matches = content.match(/data\?\.segmentSummary\?\.segments\?\.find/g);
console.log('Number of .find calls for segments:', matches ? matches.length : 0);
