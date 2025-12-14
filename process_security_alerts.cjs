const fs = require('node:fs');

const inputFile = 'security_alerts_raw.json';
const outputFile = 'security_alerts_todo.md';

try {
  if (!fs.existsSync(inputFile)) {
    console.error(`Input file ${inputFile} not found.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  let allAlerts = [];

  // Robustly handle potentially concatenated JSON objects or valid arrays
  const trimmedRaw = raw.trim();
  try {
    // Attempt 1: Standard JSON parse
    allAlerts = JSON.parse(trimmedRaw);
  } catch (_e) {
    try {
      // Attempt 2: Handle concatenated root objects (common in some paginated outputs)
      // e.g. {...}{...} -> [{...},{...}]
      const fixedRaw = `[${trimmedRaw.replace(/}{/g, '},{')}]`;
      allAlerts = JSON.parse(fixedRaw);
    } catch (_e2) {
      // Attempt 3: Line-by-line parsing (newline delimited JSON)
      allAlerts = trimmedRaw.split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch (e) { return null; }
      }).filter(Boolean);
    }
  }

  // Handle GitHub API pagination wrapper if present
  // If result is an array of pages { data: { ... } }, flatten it
  if (allAlerts.length > 0 && (allAlerts[0].data || allAlerts[0].nodes)) {
    const flattened = [];
    allAlerts.forEach(page => {
      if (page.data?.repository?.codeScanningAlerts?.nodes) {
        flattened.push(...page.data.repository.codeScanningAlerts.nodes);
      } else if (Array.isArray(page)) {
        flattened.push(...page);
      }
    });
    if (flattened.length > 0) allAlerts = flattened;
  }

  // Deduplicate by number
  const uniqueAlertsMap = new Map();
  allAlerts.forEach(a => { if (a && a.number) uniqueAlertsMap.set(a.number, a); });
  const uniqueAlerts = Array.from(uniqueAlertsMap.values());

  const total = uniqueAlerts.length;
  console.log(`Found ${total} unique alerts.`);

  // Filter for open only
  const openAlerts = uniqueAlerts.filter(a => a.state === 'open' || a.state === 'OPEN');
  const openCount = openAlerts.length;

  const progress = {
    total: openCount,
    resolved: 0,
    pending: openCount
  };

  let md = `# Security Alerts Todo List

<div align="center">

### 🛡️ Security Resolution Status
<!-- RESOLUTION_STATS -->
**${progress.resolved} / ${progress.total} Resolved** (0.0%)
<!-- /RESOLUTION_STATS -->

</div>

> **Note**: This list matches the alerts found on GitHub. Mark checkboxes as [x] when you fix them locally.

`;

  // Group by Rule ID
  const byRule = {};
  openAlerts.forEach((alert) => {
    // Robust null check for rule data
    if (!alert.rule) {
      console.warn(`Alert ${alert.number} missing rule data, skipping.`);
      return;
    }

    const ruleId = alert.rule.id;
    if (!byRule[ruleId]) {
      byRule[ruleId] = {
        name: alert.rule.description || ruleId,
        severity: alert.rule.severity,
        tool: alert.tool?.name || 'Unknown',
        alerts: [],
      };
    }
    byRule[ruleId].alerts.push(alert);
  });

  // Sort rules by severity (Error > Warning > Note)
  const severityOrder = { error: 0, warning: 1, note: 2, none: 3 };
  const sortedRuleIds = Object.keys(byRule).sort((a, b) => {
    const sevA = severityOrder[byRule[a].severity.toLowerCase()] ?? 99;
    const sevB = severityOrder[byRule[b].severity.toLowerCase()] ?? 99;
    return sevA - sevB;
  });

  const severityIcons = { error: '🔴', warning: '🟠', note: '🔵' };

  sortedRuleIds.forEach((ruleId) => {
    const group = byRule[ruleId];
    const icon = severityIcons[group.severity.toLowerCase()] || '🔵';

    md += `## ${icon} ${group.name} (${group.alerts.length})\n`;
    md += `- **Rule ID**: \`${ruleId}\`\n`;
    md += `- **Severity**: ${group.severity}\n`;
    md += `- **Tool**: ${group.tool}\n\n`;

    group.alerts.forEach((alert) => {
      // Handle different API shapes (GraphQL vs REST)
      const instance = alert.mostRecentInstance || alert.most_recent_instance;
      if (!instance) return;

      const loc = instance.location;
      const path = loc.path;
      const line = loc.startLine || loc.start_line;
      const msg = (instance.message?.text || '')
        .replace(/\n/g, ' ')
        .replace(/[|`*_[\]]/g, '\\$&'); // Escape markdown special chars

      // Handle environment variables for URL construction if available, else standard fallback
      const repoOwner = process.env.REPO_OWNER || 'unknown';
      const repoName = process.env.REPO_NAME || 'unknown';
      // Fallback for REST API which provides html_url directly
      const url = alert.html_url || `https://github.com/${repoOwner}/${repoName}/security/code-scanning/${alert.number}`;

      md += `- [ ] **${path}:${line}** - ${msg} [[View Alert](${url})]\n`;
    });
    md += `\n`;
  });

  fs.writeFileSync(outputFile, md);
  console.log(`Generated ${outputFile}`);
} catch (e) {
  console.error('Error processing alerts:', e);
  process.exit(1);
}
