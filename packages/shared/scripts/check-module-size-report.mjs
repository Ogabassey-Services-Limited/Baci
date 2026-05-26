export function formatFailure({ baseline, report }) {
  const sections = [
    '[module-size] Module-size guard failed.',
    `Policy: ${baseline.roots.join(', ')} modules must stay at or below ${baseline.maxLines} lines, unless listed in the decreasing baseline. Existing baselines may shrink, but they must not grow.`,
    '',
  ];

  if (report.newOversizedModules.length > 0) {
    sections.push('New oversized module files:');
    sections.push(
      ...report.newOversizedModules.map(
        (module) => `  - ${module.path}: ${module.lineCount} lines`
      )
    );
    sections.push(
      '  Remediation: Extract focused modules or add an intentional baseline only when decomposition is explicitly scheduled.'
    );
    sections.push('');
  }

  if (report.grownModules.length > 0) {
    sections.push('Oversized modules grew past their baseline:');
    sections.push(
      ...report.grownModules.map(
        (module) =>
          `  - ${module.path}: ${module.lineCount} lines > ${module.baselineLineCount} baseline`
      )
    );
    sections.push(
      '  Remediation: Extract code until each module is back within its recorded baseline.'
    );
    sections.push('');
  }

  if (report.shrunkenBaselineEntries.length > 0) {
    sections.push('Oversized modules shrank but their baselines were not lowered:');
    sections.push(
      ...report.shrunkenBaselineEntries.map(
        (entry) => `  - ${entry.path}: ${entry.reason}`
      )
    );
    sections.push(
      '  Remediation: Lower baseline entries whenever oversized modules shrink.'
    );
    sections.push('');
  }

  if (report.staleBaselineEntries.length > 0) {
    sections.push('Stale module-size baseline entries:');
    sections.push(
      ...report.staleBaselineEntries.map(
        (entry) => `  - ${entry.path}: ${entry.reason}`
      )
    );
    sections.push(
      '  Remediation: Remove stale baseline entries so the baseline only tracks active oversized modules.'
    );
    sections.push('');
  }

  return sections.join('\n');
}
