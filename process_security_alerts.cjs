const fs = require('fs');

const inputFile = 'security_alerts_rest.json';
const outputFile = 'security_alerts_todo.md';

try {
  if (!fs.existsSync(inputFile)) {
    console.error(`Input file ${inputFile} not found.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  // gh api --paginate with REST returns concatenated arrays like [...][...]
  const jsonStr = raw.trim().replace(/\]\[/g, '],[');
  const pages = JSON.parse(`[${jsonStr}]`);

  const allAlerts = pages.flat();
  const total = allAlerts.length;
  console.log(`Found ${total} alerts.`);

  // Group by Rule ID
  const byRule = {};
  allAlerts.forEach(alert => {
    const ruleId = alert.rule.id;
    if (!byRule[ruleId]) {
      byRule[ruleId] = {
        name: alert.rule.description || ruleId,
        severity: alert.rule.severity,
        tool: alert.tool.name,
        alerts: []
      };
    }
    byRule[ruleId].alerts.push(alert);
  });

  let md = `# Security Alerts Todo List\n\n`;
  md += `**Summary**\n`;
  md += `- Total Open Alerts: ${total}\n`;
  md += `- Rule Categories: ${Object.keys(byRule).length}\n\n`;

  // Sort categories by severity
  const severityOrder = { high: 0, error: 0, medium: 1, warning: 1, low: 2, note: 2, none: 3 };
  const sortedRuleIds = Object.keys(byRule).sort((a, b) => {
    const sevA = severityOrder[byRule[a].severity.toLowerCase()] ?? 99;
    const sevB = severityOrder[byRule[b].severity.toLowerCase()] ?? 99;
    return sevA - sevB;
  });

  sortedRuleIds.forEach(ruleId => {
    const group = byRule[ruleId];
    const icon = (group.severity === 'error' || group.severity === 'high') ? '🔴' : 
                 (group.severity === 'warning' || group.severity === 'medium') ? '🟠' : '🔵';
    
    md += `## ${icon} ${group.name} (${group.alerts.length})\n`;
    md += `- **Rule ID**: \`${ruleId}\`\n`;
    md += `- **Severity**: ${group.severity}\n`;
    md += `- **Tool**: ${group.tool}\n\n`;
    
    md += `| File | Line | Message | Link |\n`;
    md += `|---|---|---|---|\n`;

    group.alerts.forEach(alert => {
      const loc = alert.most_recent_instance?.location || {};
      const path = loc.path || 'unknown';
      const line = loc.start_line || '?';
      const msg = alert.most_recent_instance?.message?.text?.replace(/\n/g, ' ').replace(/\|/g, '\\|') || 'No message';
      const url = alert.html_url;
      
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
