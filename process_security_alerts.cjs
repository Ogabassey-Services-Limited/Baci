const fs = require('fs');

const inputFile = 'security_alerts_raw.json';
const outputFile = 'security_alerts_todo.md';

try {
  if (!fs.existsSync(inputFile)) {
    console.error(`Input file ${inputFile} not found.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  // Handle paginated JSON output (concatenated objects) if needed, though gh api usually returns array if not streaming
  // But the workflow uses truncated JSON fix just in case:
  const jsonStr = raw.trim().replace(/}{/g, '},{');
  // If it's just one object, wrapped in brackets. If multiple pages cat'ed together, we might need wrapping.
  // The workflow command outputs a single JSON response for the first 100 usually, but let's be robust.

  let pages;
  try {
    pages = JSON.parse(raw);
    if (!Array.isArray(pages)) pages = [pages];
  } catch (e) {
    pages = JSON.parse(`[${jsonStr}]`);
  }

  const allAlerts = [];
  pages.forEach((page) => {
    if (page.data?.repository?.codeScanningAlerts?.nodes) {
      allAlerts.push(...page.data.repository.codeScanningAlerts.nodes);
    } else if (page.codeScanningAlerts) {
      // Direct object?
      allAlerts.push(...page.codeScanningAlerts);
    }
  });

  const total = allAlerts.length;
  console.log(`Found ${total} alerts.`);

  // Group by Rule ID
  const byRule = {};
  allAlerts.forEach((alert) => {
    const ruleId = alert.rule.id;
    if (!byRule[ruleId]) {
      byRule[ruleId] = {
        name: alert.rule.description || ruleId,
        severity: alert.rule.severity,
        tool: alert.tool.name,
        alerts: [],
      };
    }
    byRule[ruleId].alerts.push(alert);
  });

  let md = `# Security Alerts Todo List\n\n`;
  md += `**Summary**\n`;
  md += `- Total Open Alerts: ${total}\n`;
  md += `- Rule Categories: ${Object.keys(byRule).length}\n\n`;

  // Sort rules by severity (Error > Warning > Note)
  const severityOrder = { error: 0, warning: 1, note: 2, none: 3 };
  const sortedRuleIds = Object.keys(byRule).sort((a, b) => {
    const sevA = severityOrder[byRule[a].severity.toLowerCase()] ?? 99;
    const sevB = severityOrder[byRule[b].severity.toLowerCase()] ?? 99;
    return sevA - sevB;
  });

  sortedRuleIds.forEach((ruleId) => {
    const group = byRule[ruleId];
    const icon =
      group.severity === 'error'
        ? '🔴'
        : group.severity === 'warning'
          ? '🟠'
          : '🔵';

    md += `## ${icon} ${group.name} (${group.alerts.length})\n`;
    md += `- **Rule ID**: \`${ruleId}\`\n`;
    md += `- **Severity**: ${group.severity}\n`;
    md += `- **Tool**: ${group.tool}\n\n`;

    md += `| File | Line | Message | Link |\n`;
    md += `|---|---|---|---|\n`;

    group.alerts.forEach((alert) => {
      const loc = alert.mostRecentInstance.location;
      const path = loc.path;
      const line = loc.startLine;
      const msg = alert.mostRecentInstance.message.text
        .replace(/\n/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\|/g, '\\|');
      // Fix undefined env vars in link if needed, mostly for local dev we might construct manually or just omit if env vars missing
      const repoOwner = process.env.REPO_OWNER || 'ogabasseyy';
      const repoName = process.env.REPO_NAME || 'Baci';
      const url = `https://github.com/${repoOwner}/${repoName}/security/code-scanning/${alert.number}`;

      md += `| \`${path}\` | ${line} | ${msg} | [View](${url}) |\n`;
    });
    md += `\n`;
  });

  fs.writeFileSync(outputFile, md);
  console.log(`Generated ${outputFile}`);
} catch (e) {
  console.error('Error processing alerts:', e);
  process.exit(1);
}
