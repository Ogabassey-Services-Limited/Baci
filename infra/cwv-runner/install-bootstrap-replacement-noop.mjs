const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])])
        )
      : value;

export function isBootstrapReplacementNoop(state) {
  const prior = state?.prior;
  const files = state?.files;
  return (
    state?.phase === 'captured' &&
    SOURCE.test(state.sourceSha ?? '') &&
    HEX.test(state.sourceManifestSha256 ?? '') &&
    HEX.test(state.policyFileSha256 ?? '') &&
    HEX.test(state.captureSha256 ?? '') &&
    prior &&
    files &&
    typeof prior === 'object' &&
    typeof files === 'object' &&
    !Array.isArray(prior) &&
    !Array.isArray(files) &&
    Object.keys(files).length > 0 &&
    JSON.stringify(stable(prior)) === JSON.stringify(stable(files))
  );
}
const HEX = /^[0-9a-f]{64}$/;
const SOURCE = /^[0-9a-f]{40}$/;
