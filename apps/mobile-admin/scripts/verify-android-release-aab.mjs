import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ML_KIT_SCANNER_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';
const ADVERTISING_ID_PERMISSION = 'com.google.android.gms.permission.AD_ID';
const USAGE =
  'Usage: verify-android-release-aab.mjs --aab <path> --mapping <path> --bundletool <path>';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function findReleaseArtifactIssues({
  archiveEntries,
  manifestXml,
  mappingSize,
  r8Metadata,
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

  let hasParsedR8Metadata = false;
  let parsedR8Metadata;
  if (hasR8Metadata) {
    try {
      const candidate = JSON.parse(r8Metadata);
      if (
        !isRecord(candidate) ||
        !isRecord(candidate.options) ||
        !isRecord(candidate.resourceOptimization)
      ) {
        throw new Error('Unexpected R8 metadata shape');
      }
      parsedR8Metadata = candidate;
      hasParsedR8Metadata = true;
    } catch {
      issues.push('AAB contains invalid R8 metadata');
    }
  }

  if (hasParsedR8Metadata) {
    if (parsedR8Metadata?.options?.isOptimizationsEnabled !== true) {
      issues.push('R8 code optimization is disabled');
    }
    if (parsedR8Metadata?.options?.isRepackageClassesEnabled !== true) {
      issues.push('R8 class repackaging is disabled');
    }
    if (
      parsedR8Metadata?.resourceOptimization?.isOptimizedShrinkingEnabled !==
      true
    ) {
      issues.push('R8 optimized resource shrinking is disabled');
    }
  }

  const scannerActivity = manifestXml
    .match(/<activity\b[\s\S]*?>/g)
    ?.find((activity) => activity.includes(ML_KIT_SCANNER_ACTIVITY));
  if (scannerActivity?.includes('android:screenOrientation=')) {
    issues.push('ML Kit barcode scanner activity still locks an orientation');
  }

  if (manifestXml.includes(ADVERTISING_ID_PERMISSION)) {
    issues.push('AAB still requests the unused Advertising ID permission');
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
  const r8MetadataEntry = 'BUNDLE-METADATA/com.android.tools/r8.json';
  const r8Metadata = archiveEntries.includes(r8MetadataEntry)
    ? execFileSync('unzip', ['-p', aabPath, r8MetadataEntry], {
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
      })
    : undefined;
  const mappingSize = statSync(mappingPath).size;
  const issues = findReleaseArtifactIssues({
    archiveEntries,
    manifestXml,
    mappingSize,
    r8Metadata,
  });

  if (issues.length > 0) {
    throw new Error(
      `Android release recommendation verification failed:\n- ${issues.join('\n- ')}`
    );
  }

  console.log(
    'Android release AAB verified: R8 optimization, repackaging, optimized resource shrinking, and unrestricted ML Kit orientation are active.'
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
