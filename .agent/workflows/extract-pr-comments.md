---
description: Extract all PR comments and review threads into a structured Markdown Todo list
---

This workflow fetches all comments and review threads from a GitHub Pull Request (including resolved status) using the GitHub CLI's GraphQL API, and parses them into a clean Markdown table.

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated.
- Node.js installed.

**Arguments:**
- `PR_NUMBER`: The pull request number (e.g., 119).

### 1. Fetch PR Data
First, fetch the raw data from GitHub. We use GraphQL to get the `isResolved` status of review threads, which isn't easily available in the REST API.

```bash
# Set your PR number here
export PR_NUMBER=119
# Verify repo context or set explicitly if needed
export REPO_OWNER=$(gh repo view --json owner -q .owner.login)
export REPO_NAME=$(gh repo view --json name -q .name)

echo "Fetching data for PR #$PR_NUMBER from $REPO_OWNER/$REPO_NAME..."

gh api graphql --paginate -f query='
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
}' -F owner="$REPO_OWNER" -F name="$REPO_NAME" -F pr=$PR_NUMBER > pr_${PR_NUMBER}_full_threads.json
```

### 2. Create the Parser Script
Create a Node.js script to process the JSON and generate the Markdown report.

```javascript
// turbo
cat << 'EOF' > process_pr_comments.cjs
const fs = require('fs');

const prNumber = process.env.PR_NUMBER || 'unknown';
const inputFile = `pr_${prNumber}_full_threads.json`;
const outputFile = `pr_${prNumber}_todo.md`;

try {
  if (!fs.existsSync(inputFile)) {
    console.error(`Input file ${inputFile} not found.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  
  // Handle concatenated JSON objects from paginated output
  const jsonStr = raw.trim().replace(/}{/g, '},{');
  const pages = JSON.parse(`[${jsonStr}]`);

  const allThreads = [];
  const allGeneralComments = [];

  pages.forEach(page => {
    const pr = page.data?.repository?.pullRequest;
    if (!pr) return;
    
    if (pr.reviewThreads) {
      allThreads.push(...pr.reviewThreads.nodes);
    }
    if (pr.comments) {
      allGeneralComments.push(...pr.comments.nodes);
    }
  });

  // Filter out resolved threads
  const unresolved = allThreads.filter(t => !t.isResolved);
  const resolved = allThreads.filter(t => t.isResolved);
  
  const total = allThreads.length;
  const resolutionRate = total > 0 ? ((resolved.length / total) * 100).toFixed(1) : '0.0';

  let md = `# PR #${prNumber} Todo List\n\n`;
  
  // Stats
  md += `**Summary**\n`;
  md += `- Total Threads: ${total}\n`;
  md += `- ✅ Resolved: ${resolved.length}\n`;
  md += `- 🔴 Pending: ${unresolved.length}\n`;
  md += `- 📊 Completion: **${resolutionRate}%**\n`;
  md += `- 💬 General Comments: ${allGeneralComments.length}\n\n`;

  // Resolved items section (collapsible)
  md += '\n## ✅ Resolved Items\n\n';
  md += '<details>\n<summary>Click to see <b>' + resolved.length + '</b> resolved threads</summary>\n\n';
  md += '| File | Author | Comment | Link |\n';
  md += '|---|---|---|---|\n';
  
  resolved.forEach(thread => {
    const comment = thread.comments.nodes[0];
    if (!comment) return;
    
    const body = comment.body.replace(/\n/g, ' ').substring(0, 80) + (comment.body.length > 80 ? '...' : '');
    const path = thread.path || 'General';
     const safeBody = body.replace(/\|/g, '\\|');
    md += `| \`${path}\` | ${comment.author?.login} | ${safeBody} | [View](${comment.url}) |\n`;
  });
  
  md += '\n</details>\n';

  // Pending items (Grouped by File)
  md += '\n## 🔴 Pending Action Items (Clustered)\n\n';
  
  if (unresolved.length === 0) {
    md += '🎉 No pending items!\n';
  } else {
    // Grouping logic
    const byFile = {};
    unresolved.forEach(thread => {
        const path = thread.path || 'General';
        if (!byFile[path]) byFile[path] = [];
        byFile[path].push(thread);
    });

    Object.keys(byFile).sort().forEach(filePath => {
        const threads = byFile[filePath];
        md += `### 📄 \`${filePath}\` (${threads.length})\n`;
        
        md += '| Author | Comment | Link |\n';
        md += '|---|---|---|\n'; // 3 columns now, file is header
        
        threads.forEach(thread => {
            const comment = thread.comments.nodes[0];
            if (!comment) return;
            
            // Clean body
            const body = comment.body
                .replace(/\n/g, ' <br> ') // Preserve line breaks safely
                .replace(/\\/g, '\\\\')   // Escape backslashes first
                .replace(/\|/g, '\\|');   // Escape table pipes
                
            md += `| **${comment.author?.login || 'unknown'}** | ${body} | [View](${comment.url}) |\n`;
        });
        md += '\n';
    });
  }
  
  // General Comments
  if (allGeneralComments.length > 0) {
    md += '\n## 💬 General Discussion\n\n';
    allGeneralComments.forEach(c => {
       const body = c.body.replace(/\n/g, ' <br> ');
       md += `> **${c.author?.login}**: ${body}\n\n`;
    });
  }
  
  // Footer Progress
  md += '\n---\n';
  md += `**Progress**: ${resolved.length}/${total} (${resolutionRate}%) Resolved\n`;

  fs.writeFileSync(outputFile, md);
  console.log(`Successfully generated ${outputFile}`);

} catch (e) {
  console.error('Error processing JSON:', e);
  process.exit(1);
}
EOF
```

### 3. Run the Parser
Execute the script to generate the markdown file.

```bash
# turbo
node process_pr_comments.cjs
```

### 4. Review Output
Open the generated file.

```bash
# Replace 119 with your PR number
# turbo
cat pr_${PR_NUMBER}_todo.md
```
