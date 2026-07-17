import { captureProductionEffectProvenance } from './capture-production-effect-provenance';
import { parseProductionEffectCaptureArguments } from './parse-production-effect-capture-arguments';
import { replayRepository } from './replay-repository-root';

const CAPTURE_FAILURE_DIAGNOSTIC =
  'Production-effect provenance capture failed';

async function main() {
  try {
    const parsed = parseProductionEffectCaptureArguments(process.argv.slice(2));
    await captureProductionEffectProvenance({
      ...parsed,
      semanticFixtureOutput:
        parsed.semanticFixtureOutput ??
        'apps/web/tools/db/fixtures/github-migration-semantic-lines.json',
      workspaceRoot: replayRepository.root(import.meta.dirname),
    });
  } catch {
    console.error(CAPTURE_FAILURE_DIAGNOSTIC);
    process.exitCode = 1;
  }
}

void main();
