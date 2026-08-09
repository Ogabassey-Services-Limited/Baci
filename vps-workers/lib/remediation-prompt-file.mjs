import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { remediationArtifactKeyFor } from './remediation-artifact-key.mjs';
import { buildCodexRemediationPrompt } from './remediation-policy.mjs';

export function writeRemediationPrompt({ candidate, outputDir }) {
  mkdirSync(outputDir, { recursive: true });
  const path = join(outputDir, `${remediationArtifactKeyFor(candidate)}.prompt.md`);
  writeFileSync(path, buildCodexRemediationPrompt({ candidate }));
  return path;
}
