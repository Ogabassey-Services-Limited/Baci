const fs = require('fs');

const inputFile = 'security_alerts_raw.json';
const outputFile = 'security_alerts_todo.md';

try {
    if (!fs.existsSync(inputFile)) {
        console.error(`Input file ${inputFile} not found.`);
        process.exit(1);
    }

    const raw = fs.readFileSync(inputFile, 'utf8');
    const allAlerts = JSON.parse(raw);

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

    // Sort rules by severity (Error > Warning > Note)
    const severityOrder = { error: 0, warning: 1, note: 2, none: 3 };
    const sortedRuleIds = Object.keys(byRule).sort((a, b) => {
        const sevA = severityOrder[(byRule[a].severity || 'none').toLowerCase()] ?? 99;
        const sevB = severityOrder[(byRule[b].severity || 'none').toLowerCase()] ?? 99;
        return sevA - sevB;
    });

    sortedRuleIds.forEach(ruleId => {
        const group = byRule[ruleId];
        const icon = group.severity === 'error' ? '🔴' : group.severity === 'warning' ? '🟠' : '🔵';

        md += `## ${icon} ${group.name} (${group.alerts.length})\n`;
        md += `- **Rule ID**: \`${ruleId}\`\n`;
        md += `- **Severity**: ${group.severity}\n`;
        md += `- **Tool**: ${group.tool}\n\n`;

        md += `| File | Line | Message | Link |\n`;
        md += `|---|---|---|---|\n`;

        group.alerts.forEach(alert => {
            // Handle REST API structure (snake_case)
            const instance = alert.most_recent_instance;
            const path = instance.location.path;
            const line = instance.location.start_line;
            const msg = instance.message.text.replace(/\\/g, '\\\\').replace(/\n/g, ' ').replace(/\|/g, '\\|');
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
