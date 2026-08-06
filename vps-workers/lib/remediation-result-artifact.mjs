import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function writeRemediationResultArtifact({
  candidate,
  output,
  outputDir,
}) {
  if (!outputDir) {
    return undefined;
  }

  const fingerprint = String(candidate.fingerprint || 'unknown').replace(
    /[^a-zA-Z0-9_-]/g,
    '-'
  );
  mkdirSync(outputDir, { recursive: true });
  const path = join(outputDir, `${fingerprint}.result.md`);
  writeFileSync(
    path,
    [
      `# Codex investigation ${fingerprint}`,
      '',
      String(output || '').trim(),
      '',
    ].join('\n'),
    { mode: 0o600 }
  );
  return path;
}
