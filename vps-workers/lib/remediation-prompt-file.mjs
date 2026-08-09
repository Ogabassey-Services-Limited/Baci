import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { remediationArtifactKeyFor } from './remediation-artifact-key.mjs';
import { buildCodexRemediationPrompt } from './remediation-policy.mjs';

export function writeRemediationPrompt({ candidate, outputDir }) {
  mkdirSync(outputDir, { mode: 0o700, recursive: true });
  chmodSync(outputDir, 0o700);
  const path = join(
    outputDir,
    `${remediationArtifactKeyFor(candidate)}.prompt.md`
  );
  writeFileSync(path, buildCodexRemediationPrompt({ candidate }), {
    mode: 0o600,
  });
  chmodSync(path, 0o600);
  return path;
}
