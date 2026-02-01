const fs = require('fs');

const inputFile = 'security_alerts_raw.json';
const outputFile = 'security_alerts_todo.md';

try {
    if (!fs.existsSync(inputFile)) {
        console.error(`Input file ${inputFile} not found.`);
        process.exit(1);
    }

    const raw = fs.readFileSync(inputFile, 'utf8');

    // Handle paginated REST API JSON output (concatenated arrays: [...][...])
    // We need to split them or find a way to parse.
    // A simple way is to replace '][' with ',' and wrap in []
    const jsonStr = raw.trim().replace(/\]\[/g, '],[');
    const pages = JSON.parse(`[${jsonStr}]`);

    const allAlerts = [];
    pages.forEach(page => {
        if (Array.isArray(page)) {
            allAlerts.push(...page);
        }
    });

    const total = allAlerts.length;
    console.log(`Found ${total} alerts.`);

    // Group by Rule ID
    const byRule = {};
    allAlerts.forEach(alert => {
        // Only process OPEN alerts (though API should have filtered, let's be safe)
        if (alert.state !== 'open') return;

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

    const openCount = Object.values(byRule).reduce((acc, group) => acc + group.alerts.length, 0);

    let md = `# Security Alerts Todo List\n\n`;
    md += `**Summary**\n`;
    md += `- Total Alerts Fetched: ${total}\n`;
    md += `- Total Open Alerts: ${openCount}\n`;
    md += `- Rule Categories: ${Object.keys(byRule).length}\n\n`;

    // Sort rules by severity (Error > Warning > Note)
    const severityOrder = { critical: 0, high: 1, error: 2, warning: 3, medium: 4, low: 5, note: 6, none: 7 };
    const sortedRuleIds = Object.keys(byRule).sort((a, b) => {
        const sevA = severityOrder[byRule[a].severity.toLowerCase()] ?? 99;
        const sevB = severityOrder[byRule[b].severity.toLowerCase()] ?? 99;
        return sevA - sevB;
    });

    sortedRuleIds.forEach(ruleId => {
        const group = byRule[ruleId];
        const sev = group.severity.toLowerCase();
        const icon = (sev === 'critical' || sev === 'high' || sev === 'error') ? '🔴' : (sev === 'warning' || sev === 'medium') ? '🟠' : '🔵';

        md += `## ${icon} ${group.name} (${group.alerts.length})\n`;
        md += `- **Rule ID**: \`${ruleId}\`\n`;
        md += `- **Severity**: ${group.severity}\n`;
        md += `- **Tool**: ${group.tool}\n\n`;

        md += `| File | Line | Message | Link |\n`;
        md += `|---|---|---|---|\n`;

        group.alerts.forEach(alert => {
            const loc = alert.most_recent_instance.location;
            const path = loc.path;
            const line = loc.start_line;
            const msg = alert.most_recent_instance.message.text.replace(/\n/g, ' ').replace(/\|/g, '\\|');
            const url = alert.html_url;

            md += `| \`${path}\` | ${line} | ${msg} | [View](${url}) |\n`;
        });
        md += `\n`;
    });

    fs.writeFileSync(outputFile, md);
    console.log(`Generated ${outputFile} with ${openCount} open alerts.`);

} catch (e) {
    console.error('Error processing alerts:', e);
    process.exit(1);
}
