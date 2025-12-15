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

  // Handle expected array from REST API
  // gh api --paginate returns concatenated JSON arrays (e.g. [...][...])
  // We need to fix this to be a valid single generic array or handle the concatenation
  try {
    allAlerts = JSON.parse(raw);
  } catch (_e) {
    // Try fixing concatenated arrays format: ][ -> ,
    const fixedRaw = raw.replace(/\]\s*\[/g, ',');
    allAlerts = JSON.parse(fixedRaw);
  }


  // Deduplicate by number (use optional chaining for safety)
  const uniqueAlertsMap = new Map();
  allAlerts.forEach((a) => {
    if (a?.number) uniqueAlertsMap.set(a.number, a);
  });
  const uniqueAlerts = Array.from(uniqueAlertsMap.values());

  const total = uniqueAlerts.length;
  console.log(`Found ${total} unique alerts.`);

  // Filter for open only
  const openAlerts = uniqueAlerts.filter(a => a.state === 'open');
  const openCount = openAlerts.length;

  // Initialize counts
  // We manually fixed 23 alerts (High + Medium)
  // Pending = Open Count in GitHub (which is outdated since we haven't pushed yet)
  // So "Resolved" should be tracked by us, or we just report what GitHub sees?
  // User wants to see progress of *this session*.
  // Ideally, we start with Pending = openCount.
  // Then we mark 23 as [x].
  // So Total = openCount.
  // Resolved = 0 (initially).
  // But wait, if I mark them [x] in the file, that's done manually.
  // The header calculation uses `progress.resolved`.
  // I should set `progress.resolved` to 23 manually? No, the script generates the file.
  // The User edits the file to mark [x].
  // So the script should produce [ ] for all open alerts.
  // And the header will stay 0/Total until the user ticks them?
  // OR I can hardcode the "Fixed" logic if I know which ones I fixed?
  // Better: Just report "Open on GitHub". User marks [x].

  const progress = {
    total: openCount,
    resolved: 0,
    pending: openCount
  };

  const percentResolved = progress.total > 0 ? ((progress.resolved / progress.total) * 100).toFixed(1) : '0.0';

  let md = `# Security Alerts Todo List

<div align="center">

### 🛡️ Security Resolution Status
<!-- RESOLUTION_STATS -->
**${progress.resolved} / ${progress.total} Resolved** (${percentResolved}%)
<!-- /RESOLUTION_STATS -->

</div>

> **Note**: This list matches the alerts found on GitHub. Mark checkboxes as [x] when you fix them locally.

`;

  // Group by Rule ID (with null safety)
  const byRule = {};
  openAlerts.forEach((alert) => {
    // Filter for open state
    if (alert.state !== 'open') return;

    const ruleId = alert.rule?.id;
    if (!ruleId) return; // Skip alerts without rule ID

    if (!byRule[ruleId]) {
      byRule[ruleId] = {
        name: alert.rule?.description || ruleId,
        severity: alert.rule?.severity || 'unknown',
        tool: alert.tool?.name || 'Unknown tool',
        alerts: [],
      };
    }
    byRule[ruleId].alerts.push(alert);
  });

  // Sort rules by severity (Error > Warning > Note)
  const severityOrder = { error: 0, warning: 1, note: 2, none: 3 };
  const sortedRuleIds = Object.keys(byRule).sort((a, b) => {
    const sevA = severityOrder[byRule[a].severity?.toLowerCase()] ?? 99;
    const sevB = severityOrder[byRule[b].severity?.toLowerCase()] ?? 99;
    return sevA - sevB;
  });

  sortedRuleIds.forEach((ruleId) => {
    const group = byRule[ruleId];
    const severityLower = group.severity?.toLowerCase();
    const icon =
      severityLower === 'error'
        ? '🔴'
        : severityLower === 'warning'
          ? '🟠'
          : '🔵';

    md += `## ${icon} ${group.name} (${group.alerts.length})\n`;
    md += `- **Rule ID**: \`${ruleId}\`\n`;
    md += `- **Severity**: ${group.severity}\n`;
    md += `- **Tool**: ${group.tool}\n\n`;

    group.alerts.forEach((alert) => {
      const instance = alert.most_recent_instance;
      const loc = instance?.location;
      if (!loc) return; // Skip if no location info

      const path = loc.path || 'unknown';
      const line = loc.start_line || 0;
      const msg = (instance.message?.text || '')
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/\n/g, ' ')
        .replace(/\|/g, '\\|')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]');
      const url = alert.html_url;

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
