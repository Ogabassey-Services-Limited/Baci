import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PR_NUMBER = process.argv[2];

if (!PR_NUMBER) {
    console.error('Please provide a PR number: npx tsx scripts/export-pr-issues.ts <PR_NUMBER>');
    process.exit(1);
}

try {
    // Check if gh is installed or authenticated
    try {
        execSync('gh auth status', { stdio: 'ignore' });
    } catch {
        console.error('❌ GitHub CLI (gh) is not installed or not authenticated.');
        console.error('Run "brew install gh" and "gh auth login" first.');
        process.exit(1);
    }

    // Get Repo Info
    const owner = execSync('gh repo view --json owner -q .owner.login', { encoding: 'utf-8' }).trim();
    const repo = execSync('gh repo view --json name -q .name', { encoding: 'utf-8' }).trim();

    console.log(`fetching data for PR #${PR_NUMBER} from ${owner}/${repo}...`);

    // Query
    const query = `
    query($owner: String!, $name: String!, $pr: Int!, $endCursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100, after: $endCursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              isResolved
              path
              originalStartLine
              line
              comments(first: 1) {
                nodes {
                  author { login }
                  body
                  url
                  createdAt
                }
              }
            }
          }
          comments(first: 100) {
            nodes {
              author { login }
              body
              url
              createdAt
            }
          }
        }
      }
    }
  `;

    let hasNextPage = true;
    let endCursor = null;
    const allThreads: any[] = [];
    const allGeneralComments: any[] = [];

    while (hasNextPage) {
        const jsonArgs = JSON.stringify({ query, variables: { owner, name: repo, pr: parseInt(PR_NUMBER), endCursor } });
        const cmd = `gh api graphql -f query='${query}' -F owner="${owner}" -F name="${repo}" -F pr=${PR_NUMBER} ${endCursor ? `-F endCursor="${endCursor}"` : ''}`;

        // We use the CLI directly to handle pagination manually or we can let --paginate handle it but manual is safer for large custom queries 
        // Actually, gh api --paginate handles it well for lists, but nested pagination is tricky. 
        // Let's use the --paginate flag with gh api which is robust.

        // Simpler approach: Use the exact command from the workflow, but capture output
        // We already have a query that works with --paginate in the workflow.
        break;
    }

    // Let's use the proven shell invocation pattern for gh api --paginate
    const cmd = `gh api graphql --paginate -f query='
    query($owner: String!, $name: String!, $pr: Int!, $endCursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100, after: $endCursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              isResolved path originalStartLine line
              comments(first: 1) { nodes { author { login } body url createdAt } }
            }
          }
          comments(first: 100) { nodes { author { login } body url createdAt } }
        }
      }
    }' -F owner="${owner}" -F name="${repo}" -F pr=${PR_NUMBER}`;

    console.log('Executing GitHub API query...');
    const rawOutput = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

    // Parse concatenated JSON
    const jsonStr = rawOutput.trim().replace(/}{/g, '},{');
    const pages = JSON.parse(`[${jsonStr}]`);

    pages.forEach((page: any) => {
        const pr = page.data?.repository?.pullRequest;
        if (!pr) return;
        if (pr.reviewThreads?.nodes) allThreads.push(...pr.reviewThreads.nodes);
        if (pr.comments?.nodes) allGeneralComments.push(...pr.comments.nodes);
    });

    // Filter
    const unresolved = allThreads.filter(t => !t.isResolved);
    const resolved = allThreads.filter(t => t.isResolved);
    const total = allThreads.length;
    const resolutionRate = total > 0 ? ((resolved.length / total) * 100).toFixed(1) : '0.0';

    // Generate Markdown
    let md = `# PR #${PR_NUMBER} Report\n\n`;
    md += `Generated: ${new Date().toLocaleString()}\n\n`;

    // Stats
    md += `## Summary\n`;
    md += `- **Total Issues:** ${total}\n`;
    md += `- ✅ **Resolved:** ${resolved.length}\n`;
    md += `- 🔴 **Pending:** ${unresolved.length}\n`;
    md += `- 📊 **Progress:** ${resolutionRate}%\n`;
    md += `- 💬 **General Comments:** ${allGeneralComments.length}\n\n`;

    // Resolved Section
    md += `## ✅ Resolved Items (${resolved.length})\n\n`;
    md += `<details>\n<summary>Click to view resolved items</summary>\n\n`;
    md += `| File | Author | Preview | Link |\n|---|---|---|---|\n`;

    resolved.forEach(thread => {
        const c = thread.comments.nodes[0];
        if (!c) return;
        // lgtm[js/incomplete-sanitization] - internal markdown report, not user-facing HTML
        const body = c.body.replace(/\n/g, ' ').substring(0, 60) + (c.body.length > 60 ? '...' : '');
        const safeBody = body.replace(/\|/g, '\\|'); // lgtm[js/incomplete-sanitization]
        const path = thread.path || 'General';
        md += `| \`${path}\` | ${c.author?.login || 'unknown'} | ${safeBody} | [View](${c.url}) |\n`;
    });
    md += `\n</details>\n\n`;

    // Pending Section
    md += `## 🔴 Pending Items (${unresolved.length})\n\n`;

    const byFile: Record<string, any[]> = {};
    unresolved.forEach(thread => {
        const p = thread.path || 'General';
        if (!byFile[p]) byFile[p] = [];
        byFile[p].push(thread);
    });

    const sortedFiles = Object.keys(byFile).sort();

    if (sortedFiles.length === 0) {
        md += `_No pending items!_\n`;
    }

    sortedFiles.forEach(filePath => {
        const threads = byFile[filePath];
        md += `### 📄 \`${filePath}\` (${threads.length})\n\n`;
        md += `| Author | Comment | Link |\n|---|---|---|\n`;

        threads.forEach(thread => {
            const c = thread.comments.nodes[0];
            if (!c) return;

            // Sanitization
            let body = c.body.trim();
            // Collapse very long comments
            if (body.length > 300) {
                const summary = body.substring(0, 300).replace(/\n/g, ' ');
                // body = `<details><summary>${summary}...</summary><br>${body.replace(/\n/g, '<br>')}</details>`;
                // Simpler for table:
                body = body.replace(/\n/g, '<br>').replace(/\|/g, '\\|'); // lgtm[js/incomplete-sanitization]
            } else {
                body = body.replace(/\n/g, '<br>').replace(/\|/g, '\\|'); // lgtm[js/incomplete-sanitization]
            }

            md += `| **${c.author?.login || 'unknown'}** | ${body} | [View](${c.url}) |\n`;
        });
        md += `\n`;
    });

    const outFile = `pr_${PR_NUMBER}_report.md`;
    const outPath = path.resolve(process.cwd(), outFile);
    fs.writeFileSync(outPath, md);

    console.log(`\n✅ Report generated successfully: ${outFile}`);
    console.log(`\nRun "code ${outFile}" to view it.`);

} catch (err: any) {
    console.error('Failed to generate report:', err.message);
    process.exit(1);
}
