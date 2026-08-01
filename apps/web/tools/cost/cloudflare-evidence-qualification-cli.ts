import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { cloudflareEvidencePrepare } from './cloudflare-evidence-prepare';
import type { ReviewedQualificationArtifact } from './cloudflare-evidence-qualification-schemas';
import {
  QUALIFICATION_WORKER_NAME,
  qualifyCloudflareEvidenceReadback,
  ReviewedQualificationArtifactSchema,
} from './cloudflare-evidence-qualification-schemas';

export function parseQualificationArguments(args: readonly string[]) {
  if (args[0] === '--prepare')
    throw new Error('prepare options require the functional prepare parser');
  if (
    args.length === 8 &&
    args[0] === '--validate-readback' &&
    args[1].startsWith('/') &&
    args[2] === '--expected-artifact-a' &&
    args[3].startsWith('/') &&
    args[4] === '--expected-artifact-b' &&
    args[5].startsWith('/') &&
    args[6] === '--script-name' &&
    args[7] === QUALIFICATION_WORKER_NAME
  )
    return {
      mode: 'validate-readback' as const,
      receiptPath: args[1],
      expectedArtifactPaths: [args[3], args[5]] as const,
      scriptName: args[7],
    };
  throw new Error(
    'qualification is credentialless and accepts only --prepare or --validate-readback <absolute-receipt> --expected-artifact-a <absolute-artifact> --expected-artifact-b <absolute-artifact> --script-name <name>'
  );
}

export function buildClosedEvidenceProcessEnvironment(
  credentialName: 'CLOUDFLARE_WRITE_TOKEN' | 'CLOUDFLARE_READ_TOKEN',
  credential: string,
  inherited: Readonly<Record<string, string | undefined>>
) {
  if (inherited.CLOUDFLARE_WRITE_TOKEN || inherited.CLOUDFLARE_READ_TOKEN)
    throw new Error('evidence process inherited a credential');
  const environment: Record<string, string> = {};
  for (const name of ['PATH', 'TMPDIR'] as const)
    if (inherited[name]) environment[name] = inherited[name];
  environment[credentialName] = credential;
  return environment;
}

type QualificationCliIo = Readonly<{
  stdout: (value: string) => void;
  stderr: (value: string) => void;
  setExitCode: (code: number) => void;
}>;

async function readReviewedArtifact(path: string, label: string) {
  if (!isAbsolute(path))
    throw new Error(`${label} artifact path must be absolute`);
  const stat = await lstat(path).catch(() => {
    throw new Error(`${label} artifact is not readable`);
  });
  if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o777) !== 0o600)
    throw new Error(`${label} artifact must be a private regular file`);
  return readFile(path, 'utf8');
}

export async function runQualificationCli(
  args: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
  io: QualificationCliIo
) {
  try {
    if (args[0] === '--prepare') {
      await cloudflareEvidencePrepare.run(args, environment, io.stdout);
      return;
    }
    if (args[0] === '--validate-readback') {
      const { receiptPath, expectedArtifactPaths, scriptName } =
        parseQualificationArguments(args);
      const [value, ...artifactValues] = await Promise.all([
        readReviewedArtifact(receiptPath, 'readback'),
        ...expectedArtifactPaths.map((path, index) =>
          readReviewedArtifact(path, `expected artifact ${index + 1}`)
        ),
      ]);
      const parsedArtifacts = artifactValues.map((artifactValue) => {
        const parsed = ReviewedQualificationArtifactSchema.safeParse(
          JSON.parse(artifactValue)
        );
        if (!parsed.success)
          throw new Error('reviewed local artifact receipt is invalid');
        return parsed.data;
      });
      const [artifactA, artifactB] = parsedArtifacts;
      if (!artifactA || !artifactB)
        throw new Error('two reviewed local artifact receipts are required');
      const expectedArtifacts: readonly [
        ReviewedQualificationArtifact,
        ReviewedQualificationArtifact,
      ] = [artifactA, artifactB];
      const result = qualifyCloudflareEvidenceReadback(JSON.parse(value), {
        expectedArtifacts,
        expectedScriptName: scriptName,
      });
      if (!result.ok) throw new Error(result.reason);
      io.stdout(`${JSON.stringify(result.qualification)}\n`);
      return;
    }
    parseQualificationArguments(args);
  } catch (error: unknown) {
    io.stderr(
      `${error instanceof Error ? error.message : 'qualification failed'}\n`
    );
    io.setExitCode(1);
  }
}

export function runQualificationCliFromProcess() {
  void runQualificationCli(process.argv.slice(2), process.env, {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
    setExitCode: (code) => {
      process.exitCode = code;
    },
  });
}
