const fs = require('fs');
const prNumbers = ["217", "216", "215", "213", "212", "211", "210", "209", "208", "207", "206", "205"];

let report = "# PR Consolidated Review Report\n\n";

for (const prNum of prNumbers) {
  const file = `pr_${prNum}_threads.json`;
  if (!fs.existsSync(file)) continue;
  
  try {
    const raw = fs.readFileSync(file, 'utf8');
    // gh api graphql --paginate can return multiple JSON objects if not handled.
    // But since I used graphql with -F, it should be a single object unless paginated.
    // Let's assume it might have multiple if it hit a 100 limit (unlikely here but safe).
    const data = JSON.parse(raw);
    const pr = data.data?.repository?.pullRequest;
    if (!pr) continue;

    report += `## PR #${prNum}\n`;
    report += `### Threads\n`;
    
    if (pr.reviewThreads && pr.reviewThreads.nodes.length === 0) {
      report += "No review threads.\n";
    } else if (pr.reviewThreads) {
      pr.reviewThreads.nodes.forEach(thread => {
        const comment = thread.comments.nodes[0];
        if (!comment) return;
        report += `- [${thread.isResolved ? '✅' : '🔴'}] **${thread.path || 'General'}**: ${comment.author.login}: ${comment.body.replace(/\n/g, ' ')}\n`;
      });
    }

    if (pr.comments && pr.comments.nodes.length > 0) {
      report += `### General Comments\n`;
      pr.comments.nodes.forEach(c => {
        report += `- **${c.author.login}**: ${c.body.replace(/\n/g, ' ')}\n`;
      });
    }
    report += "\n---\n";
  } catch (err) {
    console.error(`Error parsing PR #${prNum}:`, err.message);
  }
}

fs.writeFileSync('pr_review_report.md', report);
