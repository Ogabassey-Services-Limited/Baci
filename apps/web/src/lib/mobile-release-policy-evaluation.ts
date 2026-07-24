/**
 * Pure evaluation of the mobile in-app update gate, extracted from the
 * `/api/mobile/release-policy` route so the S0-B minimum-version enforcement is
 * unit-testable in isolation from env/DB reads. The route still owns config
 * resolution (env + `mobile_release_gate`) and passes the resolved values here.
 *
 * The gate is config-driven and permissive by default: with no configured
 * minimum version/build and no known live build, both flags are `false`, so
 * merging this before any release exists is safe (nothing is blocked). S0-B
 * flips the storefront `MIN_BUILD` to the build carrying the order-scoped
 * receipt/bank boundary only after that release is live.
 */

/** Parse a dotted marketing version into numeric parts, or null when invalid. */
export function parseVersion(version: string | null): number[] | null {
  if (!version) return null;
  const parts = version
    .trim()
    .split('.')
    .map((part) => Number(part));

  if (
    parts.length === 0 ||
    parts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    return null;
  }

  return parts;
}

/**
 * Compare two dotted versions. Returns 1 (left>right), -1 (left<right), or 0
 * (equal, or either side unparseable — an unknown minimum never gates).
 */
export function compareVersions(
  left: string | null,
  right: string | null
): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) return 0;

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
}

export interface NativeUpdateGateInput {
  /** The installed build's marketing version (e.g. "2.1.0"). */
  nativeVersion: string | null;
  /** Operator-forced minimum marketing version, or null when unset. */
  minNativeVersion: string | null;
  /** The installed native build number, or null when absent/malformed. */
  installedBuild: number | null;
  /** Operator-forced minimum build number, or null when unset. */
  minNativeBuild: number | null;
  /** The store's actual latest live build, or null when unknown. */
  latestNativeBuild: number | null;
}

export interface NativeUpdateGate {
  nativeUpdateRequired: boolean;
  nativeUpdateRecommended: boolean;
}

/**
 * Decide whether the installed build must / should update.
 *
 * REQUIRED is an operator-forced floor: the marketing version below
 * MIN_VERSION, or the build below MIN_BUILD. Both are deliberately set by an
 * operator, so the version signal is safe here.
 *
 * RECOMMENDED is driven ONLY by the live build number (plus REQUIRED). We do
 * NOT OR in LATEST_VERSION: that env value can be set ahead of the store's live
 * version, which would recommend an unreleased build and defeat the live-build
 * gate.
 */
export function evaluateNativeUpdateGate(
  input: NativeUpdateGateInput
): NativeUpdateGate {
  const {
    nativeVersion,
    minNativeVersion,
    installedBuild,
    minNativeBuild,
    latestNativeBuild,
  } = input;

  const nativeUpdateRequired =
    (minNativeVersion !== null &&
      compareVersions(nativeVersion, minNativeVersion) < 0) ||
    (installedBuild !== null &&
      minNativeBuild !== null &&
      installedBuild < minNativeBuild);

  const nativeUpdateRecommended =
    nativeUpdateRequired ||
    (installedBuild !== null &&
      latestNativeBuild !== null &&
      installedBuild < latestNativeBuild);

  return { nativeUpdateRecommended, nativeUpdateRequired };
}
