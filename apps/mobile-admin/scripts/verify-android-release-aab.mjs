import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ML_KIT_SCANNER_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';
const USAGE =
  'Usage: verify-android-release-aab.mjs --aab <path> --mapping <path> --bundletool <path>';

export function findReleaseArtifactIssues({
  archiveEntries,
  manifestXml,
  mappingSize,
}) {
  const issues = [];

  if (mappingSize <= 0) {
    issues.push('R8 mapping output is missing or empty');
  }

  const hasProguardMap = archiveEntries.includes(
    'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map'
  );
  const hasR8Metadata = archiveEntries.includes(
    'BUNDLE-METADATA/com.android.tools/r8.json'
  );
  if (!hasProguardMap || !hasR8Metadata) {
    issues.push('AAB is missing embedded R8 metadata');
  }

  const scannerActivity = manifestXml
    .match(/<activity\b[\s\S]*?>/g)
    ?.find((activity) => activity.includes(ML_KIT_SCANNER_ACTIVITY));
  if (scannerActivity?.includes('android:screenOrientation=')) {
    issues.push('ML Kit barcode scanner activity still locks an orientation');
  }

  return issues;
}

function parseArguments(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(USAGE);
    }
    values.set(flag, value);
  }

  const aabPath = values.get('--aab');
  const mappingPath = values.get('--mapping');
  const bundletoolPath = values.get('--bundletool');
  if (!aabPath || !mappingPath || !bundletoolPath) {
    throw new Error(USAGE);
  }

  return { aabPath, bundletoolPath, mappingPath };
}

function verifyReleaseAab(args) {
  const { aabPath, bundletoolPath, mappingPath } = parseArguments(args);
  const archiveEntries = execFileSync('unzip', ['-Z1', aabPath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
    .trim()
    .split('\n');
  const manifestXml = execFileSync(
    'java',
    [
      '-jar',
      bundletoolPath,
      'dump',
      'manifest',
      `--bundle=${aabPath}`,
      '--module=base',
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
  );
  const mappingSize = statSync(mappingPath).size;
  const issues = findReleaseArtifactIssues({
    archiveEntries,
    manifestXml,
    mappingSize,
  });

  if (issues.length > 0) {
    throw new Error(
      `Android release recommendation verification failed:\n- ${issues.join('\n- ')}`
    );
  }

  console.log(
    'Android release AAB verified: R8 metadata present and ML Kit orientation unrestricted.'
  );
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (executedPath === fileURLToPath(import.meta.url)) {
  try {
    verifyReleaseAab(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
