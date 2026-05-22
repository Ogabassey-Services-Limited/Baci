export function formatFailure({ baseline, report }) {
  const sections = [
    '[route-size] Route-size guard failed.',
    `Policy: app/**/*.{js,jsx,ts,tsx} route files must stay at or below ${baseline.maxLines} lines, unless listed in the decreasing baseline. Existing baselines may shrink, but they must not grow.`,
    '',
  ];

  if (report.newOversizedRoutes.length > 0) {
    sections.push('New oversized route files:');
    sections.push(
      ...report.newOversizedRoutes.map(
        (route) => `  - ${route.path}: ${route.lineCount} lines`
      )
    );
    sections.push(
      '  Remediation: Extract route-owned UI or add an intentional baseline only when decomposition is explicitly scheduled.'
    );
    sections.push('');
  }

  if (report.grownRoutes.length > 0) {
    sections.push('Oversized routes grew past their baseline:');
    sections.push(
      ...report.grownRoutes.map(
        (route) =>
          `  - ${route.path}: ${route.lineCount} lines > ${route.baselineLineCount} baseline`
      )
    );
    sections.push(
      '  Remediation: Extract code until the route is back within its recorded baseline.'
    );
    sections.push('');
  }

  if (report.shrunkenBaselineEntries.length > 0) {
    sections.push('Oversized routes shrank but their baselines were not lowered:');
    sections.push(
      ...report.shrunkenBaselineEntries.map(
        (entry) => `  - ${entry.path}: ${entry.reason}`
      )
    );
    sections.push(
      '  Remediation: Lower baseline entries whenever oversized routes shrink.'
    );
    sections.push('');
  }

  if (report.staleBaselineEntries.length > 0) {
    sections.push('Stale route-size baseline entries:');
    sections.push(
      ...report.staleBaselineEntries.map(
        (entry) => `  - ${entry.path}: ${entry.reason}`
      )
    );
    sections.push(
      '  Remediation: Remove stale baseline entries so the baseline only tracks active oversized routes.'
    );
    sections.push('');
  }

  return sections.join('\n');
}
