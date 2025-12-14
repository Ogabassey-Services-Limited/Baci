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

  pages.forEach((page) => {
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
  const unresolved = allThreads.filter((t) => !t.isResolved);
  const resolved = allThreads.filter((t) => t.isResolved);

  let md = `# PR #${prNumber} Todo List\n\n`;

  // Stats
  md += `**Summary**\n`;
  md += `- Total Threads: ${allThreads.length}\n`;
  md += `- ✅ Resolved: ${resolved.length}\n`;
  md += `- 🔴 Pending: ${unresolved.length}\n`;
  md += `- 💬 General Comments: ${allGeneralComments.length}\n\n`;

  // Pending items table
  md += '## 🔴 Pending Action Items\n\n';
  if (unresolved.length === 0) {
    md += '🎉 No pending items!\n';
  } else {
    md += '| File | Author | Comment | Link |\n';
    md += '|---|---|---|---|\n';

    unresolved.forEach((thread) => {
      const comment = thread.comments.nodes[0];
      if (!comment) return;

      const body =
        comment.body.replace(/\n/g, ' ').substring(0, 100) +
        (comment.body.length > 100 ? '...' : '');
      const path = thread.path || 'General';

      // Escape pipe characters for markdown table
      const safeBody = body.replace(/\|/g, '\\|');

      md += `| \`${path}\` | **${comment.author?.login || 'unknown'}** | ${safeBody} | [View](${comment.url}) |\n`;
    });
  }

  // Resolved items section (collapsible)
  md += '\n## ✅ Resolved Items\n\n';
  md +=
    '<details>\n<summary>Click to see <b>' +
    resolved.length +
    '</b> resolved threads</summary>\n\n';
  md += '| File | Author | Comment | Link |\n';
  md += '|---|---|---|---|\n';

  resolved.forEach((thread) => {
    const comment = thread.comments.nodes[0];
    if (!comment) return;

    const body =
      comment.body.replace(/\n/g, ' ').substring(0, 80) +
      (comment.body.length > 80 ? '...' : '');
    const path = thread.path || 'General';
    const safeBody = body.replace(/\|/g, '\\|');
    md += `| \`${path}\` | ${comment.author?.login} | ${safeBody} | [View](${comment.url}) |\n`;
  });

  md += '\n</details>\n';

  // General Comments
  if (allGeneralComments.length > 0) {
    md += '\n## 💬 General Discussion\n\n';
    allGeneralComments.forEach((c) => {
      const body = c.body.replace(/\n/g, ' <br> ');
      md += `> **${c.author?.login}**: ${body}\n\n`;
    });
  }

  fs.writeFileSync(outputFile, md);
  console.log(`Successfully generated ${outputFile}`);
} catch (e) {
  console.error('Error processing JSON:', e);
  process.exit(1);
}
