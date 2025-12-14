---
description: Fetch and parse GitHub Code Scanning security alerts into a todo list
---

This workflow fetches all open code scanning alerts from the repository and converts them into a structured Markdown list for systematic resolution.

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated.
- Node.js installed.

### 1. Fetch Security Alerts
Fetch all open code scanning alerts using the GitHub API.

```bash
# Verify repo context
export REPO_OWNER=$(gh repo view --json owner -q .owner.login)
export REPO_NAME=$(gh repo view --json name -q .name)

echo "Fetching security alerts for $REPO_OWNER/$REPO_NAME..."

# Fetch all open alerts (paginated)
gh api graphql --paginate -f query='
query($owner: String!, $name: String!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    codeScanningAlerts(first: 100, after: $endCursor, state: OPEN) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        number
        createdAt
        state
        rule {
          id
          severity
          description
          tags
        }
        tool {
          name
        }
        mostRecentInstance {
          location {
            path
            startLine
            endLine
          }
          message {
            text
          }
          classification
        }
      }
    }
  }
}' -F owner="$REPO_OWNER" -F name="$REPO_NAME" > security_alerts_raw.json
```

### 2. Create Parser Script
Create a Node.js script to process the JSON and generate the Markdown report.

```javascript
// turbo
cat << 'EOF' > process_security_alerts.cjs
const fs = require('fs');

const inputFile = 'security_alerts_raw.json';
const outputFile = 'security_alerts_todo.md';

try {
  if (!fs.existsSync(inputFile)) {
    console.error(`Input file ${inputFile} not found.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  // Handle paginated JSON output (concatenated objects)
  const jsonStr = raw.trim().replace(/}{/g, '},{');
  const pages = JSON.parse(`[${jsonStr}]`);

  const allAlerts = [];
  pages.forEach(page => {
    if (page.data?.repository?.codeScanningAlerts?.nodes) {
      allAlerts.push(...page.data.repository.codeScanningAlerts.nodes);
    }
  });

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
    const sevA = severityOrder[byRule[a].severity.toLowerCase()] ?? 99;
    const sevB = severityOrder[byRule[b].severity.toLowerCase()] ?? 99;
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
      const loc = alert.mostRecentInstance.location;
      const path = loc.path;
      const line = loc.startLine;
      const msg = alert.mostRecentInstance.message.text.replace(/\n/g, ' ').replace(/\|/g, '\\|');
      const url = `https://github.com/${process.env.REPO_OWNER}/${process.env.REPO_NAME}/security/code-scanning/${alert.number}`;
      
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
EOF
```

### 3. Run Parser
Execute the parser to generate the report.

```bash
# turbo
node process_security_alerts.cjs
```

### 4. Review Report
Open the generated markdown file.

```bash
# turbo
cat security_alerts_todo.md
```
