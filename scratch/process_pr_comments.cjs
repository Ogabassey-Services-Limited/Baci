const fs = require('fs');
const path = require('path');

const prNumber = '1879';
const inputFile = path.join(
  __dirname,
  '..',
  `pr_${prNumber}_full_threads.json`
);
const outputFile = path.join(__dirname, '..', `pr_${prNumber}_todo.md`);

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

  const total = allThreads.length;
  const resolutionRate =
    total > 0 ? ((resolved.length / total) * 100).toFixed(1) : '0.0';

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
  md +=
    '<details>\n<summary>Click to see <b>' +
    resolved.length +
    '</b> resolved threads</summary>\n\n';
  md += '| File | Author | Comment | Link |\n';
  md += '|---|---|---|---|\n';

  resolved.forEach((thread) => {
    const comment = thread.comments?.nodes?.[0];
    if (!comment) return;

    const body =
      comment.body.replace(/\n/g, ' ').substring(0, 80) +
      (comment.body.length > 80 ? '...' : '');
    const pathStr = thread.path || 'General';
    const safeBody = body.replace(/\|/g, '\\|');
    md += `| \`${pathStr}\` | ${comment.author?.login} | ${safeBody} | [View](${comment.url}) |\n`;
  });

  md += '\n</details>\n';

  // Pending items (Grouped by File)
  md += '\n## 🔴 Pending Action Items (Clustered)\n\n';

  if (unresolved.length === 0) {
    md += '🎉 No pending items!\n';
  } else {
    // Grouping logic
    const byFile = {};
    unresolved.forEach((thread) => {
      const pathStr = thread.path || 'General';
      if (!byFile[pathStr]) byFile[pathStr] = [];
      byFile[pathStr].push(thread);
    });

    Object.keys(byFile)
      .sort()
      .forEach((filePath) => {
        const threads = byFile[filePath];
        md += `### 📄 \`${filePath}\` (${threads.length})\n`;

        md += '| Author | Comment | Link |\n';
        md += '|---|---|---|\n'; // 3 columns now, file is header

        threads.forEach((thread) => {
          const comment = thread.comments?.nodes?.[0];
          if (!comment) return;

          // Clean body
          const body = comment.body
            .replace(/\n/g, ' <br> ') // Preserve line breaks safely
            .replace(/\\/g, '\\\\') // Escape backslashes first
            .replace(/\|/g, '\\|'); // Escape table pipes

          md += `| **${comment.author?.login || 'unknown'}** | ${body} | [View](${comment.url}) |\n`;
        });
        md += '\n';
      });
  }

  // General Comments
  if (allGeneralComments.length > 0) {
    md += '\n## 💬 General Discussion\n\n';
    allGeneralComments.forEach((c) => {
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
