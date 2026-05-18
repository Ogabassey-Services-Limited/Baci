export type QuizAssetManifestFile = {
  path: string;
  sha256: string;
  source?: string;
};

export type QuizAssetGeneratedManifestFile = {
  sourcePath?: string;
  repoPath: string;
  sha256: string;
};

export type QuizAssetManifest = {
  files: QuizAssetManifestFile[];
};

export type QuizAssetGeneratedManifest = {
  generatedAt?: string;
  assets: QuizAssetGeneratedManifestFile[];
};

export type QuizAssetVerificationEntry = {
  path: string;
  sha256: string;
};

export const QUIZ_ASSET_ROOT = 'apps/mobile-storefront/assets/quiz';
export const MAX_SAFE_PATH_LENGTH = 4096;

function isSafePath(value: string): boolean {
  const normalized = value.replaceAll('\\', '/');
  return (
    value.length > 0 &&
    value.length <= MAX_SAFE_PATH_LENGTH &&
    !value.includes('\0') &&
    !value.startsWith('/') &&
    !value.startsWith('\\') &&
    !/^[a-zA-Z]:[\\/]/.test(value) &&
    !normalized.split('/').includes('..')
  );
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function normalizeManifestPath(value: string): string {
  return value.replaceAll('\\', '/');
}

function isManifestFileEntry(value: unknown): value is QuizAssetManifestFile {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<QuizAssetManifestFile>;
  return (
    typeof entry.path === 'string' &&
    isSafePath(entry.path) &&
    typeof entry.sha256 === 'string' &&
    isSha256(entry.sha256)
  );
}

function isGeneratedManifestFileEntry(
  value: unknown
): value is QuizAssetGeneratedManifestFile {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<QuizAssetGeneratedManifestFile>;
  return (
    typeof entry.repoPath === 'string' &&
    isSafePath(entry.repoPath) &&
    typeof entry.sha256 === 'string' &&
    isSha256(entry.sha256)
  );
}

function normalizeGeneratedManifestEntry(
  asset: QuizAssetGeneratedManifestFile,
  errors: string[]
): QuizAssetVerificationEntry | null {
  const normalizedRepoPath = normalizeManifestPath(asset.repoPath);
  const normalizedRoot = `${QUIZ_ASSET_ROOT}/`;
  if (!normalizedRepoPath.startsWith(normalizedRoot)) {
    errors.push(`Invalid quiz asset repoPath: ${asset.repoPath}`);
    return null;
  }

  return {
    path: normalizedRepoPath.slice(normalizedRoot.length),
    sha256: asset.sha256.toLowerCase(),
  };
}

export function normalizeQuizAssetManifest(
  parsed: unknown,
  errors: string[]
): QuizAssetVerificationEntry[] | null {
  if (!parsed || typeof parsed !== 'object') {
    errors.push('Quiz asset manifest must be a JSON object');
    return null;
  }

  if ('files' in parsed) {
    const files = (parsed as { files: unknown }).files;
    if (!Array.isArray(files)) {
      errors.push('Quiz asset manifest files must be an array');
      return null;
    }

    return files
      .map((file) => {
        if (!isManifestFileEntry(file)) {
          errors.push(
            'Quiz asset manifest entries must include valid path and sha256'
          );
          return null;
        }

        return {
          path: normalizeManifestPath(file.path),
          sha256: file.sha256.toLowerCase(),
        };
      })
      .filter((entry): entry is QuizAssetVerificationEntry => entry !== null);
  }

  if ('assets' in parsed) {
    const assets = (parsed as { assets: unknown }).assets;
    if (!Array.isArray(assets)) {
      errors.push('Quiz asset manifest assets must be an array');
      return null;
    }

    return assets
      .map((asset) => {
        if (!isGeneratedManifestFileEntry(asset)) {
          errors.push(
            'Quiz asset manifest entries must include valid repoPath and sha256'
          );
          return null;
        }

        return normalizeGeneratedManifestEntry(asset, errors);
      })
      .filter((entry): entry is QuizAssetVerificationEntry => entry !== null);
  }

  errors.push('Quiz asset manifest must contain a files or assets array');
  return null;
}
