// nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Helper to run shell commands
// nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
const run = (cmd: string) => {
    try {
        // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
        return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    } catch (e: any) {
        console.error(`Command failed: ${cmd}`);
        console.error(e.message);
        process.exit(1);
    }
};

try {
    // Check auth
    try {
        execSync('gh auth status', { stdio: 'ignore' });
    } catch {
        console.error('❌ GitHub CLI (gh) not authenticated.');
        process.exit(1);
    }

    // Get Repo Info
    const owner = run('gh repo view --json owner -q .owner.login').trim();
    const repo = run('gh repo view --json name -q .name').trim();

    console.log(`Fetching security alerts for ${owner}/${repo} via REST API...`);

    // Use gh api --paginate which handles pagination automatically for REST
    const cmd = `gh api --paginate "/repos/${owner}/${repo}/code-scanning/alerts?state=open&per_page=100"`;

    console.log('Executing API request...');
    // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
    const rawOutput = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });

    // gh api --paginate outputs concatenated JSON arrays (one per page) like [...] [...]
    // We need to fix this to be valid JSON
    const jsonStr = rawOutput.trim().replace(/\]\s*\[/g, ',');
    const allAlerts = JSON.parse(jsonStr);

    console.log(`Fetched ${allAlerts.length} alerts.`);

    // Group by Rule
    const byRule: Record<string, any> = {};
    allAlerts.forEach((alert: any) => {
        const rule = alert.rule || {};
        const tool = alert.tool || {};
        const ruleId = rule.id || 'unknown-rule';

        if (!byRule[ruleId]) {
            byRule[ruleId] = {
                name: rule.description || ruleId,
                severity: rule.severity || 'unknown',
                tool: tool.name || 'unknown',
                alerts: []
            };
        }
        byRule[ruleId].alerts.push(alert);
    });

    // Generate Markdown
    let md = `# Security Alerts Todo List\n\n`;
    md += `**Summary**\n`;
    md += `- Total Open Alerts: ${allAlerts.length}\n`;
    md += `- Categories: ${Object.keys(byRule).length}\n`;
    md += `- Generated: ${new Date().toLocaleString()}\n\n`;

    const severityOrder: Record<string, number> = { error: 0, warning: 1, note: 2, none: 3, unknown: 99 };
    const sortedRuleIds = Object.keys(byRule).sort((a, b) => {
        const sA = (byRule[a].severity || 'unknown').toLowerCase();
        const sB = (byRule[b].severity || 'unknown').toLowerCase();
        return (severityOrder[sA] ?? 99) - (severityOrder[sB] ?? 99);
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

        group.alerts.forEach((alert: any) => {
            const instance = alert.most_recent_instance || {};
            const loc = instance.location || {};
            const path = loc.path || 'unknown';
            const line = loc.start_line || 0;
            // lgtm[js/incomplete-sanitization] - internal markdown report, not user-facing HTML
            const msg = (instance.message?.text || '').replace(/\n/g, ' ').replace(/\|/g, '\\|');
            const url = alert.html_url || `https://github.com/${owner}/${repo}/security/code-scanning/${alert.number}`;

            md += `| \`${path}\` | ${line} | ${msg} | [View](${url}) |\n`;
        });
        md += `\n`;
    });

    fs.writeFileSync('security_alerts_todo.md', md);
    console.log(`✅ Generated security_alerts_todo.md`);

} catch (e: any) {
    console.error('Fatal Error:', e.message);
    process.exit(1);
}
