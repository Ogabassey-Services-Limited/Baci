const fs = require('node:fs');
const prNumbers = [
  '217',
  '216',
  '215',
  '213',
  '212',
  '211',
  '210',
  '209',
  '208',
  '207',
  '206',
  '205',
];

let report = '# PR Consolidated Review Report\n\n';

for (const prNum of prNumbers) {
  const file = `pr_${prNum}_threads.json`;
  if (!fs.existsSync(file)) continue;

  try {
    const raw = fs.readFileSync(file, 'utf8');
    // gh api graphql --paginate can return multiple JSON objects concatenated
    const dataObjects = raw
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (dataObjects.length === 0) {
      try {
        dataObjects.push(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }

    report += `## PR #${prNum}\n`;
    report += `### Threads\n`;

    let threadCount = 0;
    for (const data of dataObjects) {
      const pr = data.data?.repository?.pullRequest;
      if (!pr) continue;

      if (pr.reviewThreads?.nodes) {
        pr.reviewThreads.nodes.forEach((thread) => {
          const comment = thread.comments?.nodes?.[0];
          if (!comment) return;
          threadCount++;
          const icon = thread.isResolved ? '✅' : '🔴';
          const author = comment.author?.login || 'unknown';
          const body = comment.body ? comment.body.replace(/\n/g, ' ') : '';
          report += `- [${icon}] **${thread.path || 'General'}**: ${author}: ${body}\n`;
        });
      }

      let usedGeneralComments = false;
      if (pr.comments?.nodes && pr.comments.nodes.length > 0) {
        if (!usedGeneralComments) {
          report += `### General Comments\n`;
          usedGeneralComments = true;
        }
        pr.comments.nodes.forEach((c) => {
          const author = c.author?.login || 'unknown';
          const body = c.body ? c.body.replace(/\n/g, ' ') : '';
          report += `- **${author}**: ${body}\n`;
        });
      }
    }

    if (threadCount === 0) {
      report += 'No review threads found.\n';
    }

    report += '\n---\n';
  } catch (err) {
    console.error('Error parsing PR:', { prNum, error: String(err.message) });
  }
}

fs.writeFileSync('pr_review_report.md', report);
