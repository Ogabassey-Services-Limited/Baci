const MAX_LEGACY_ANDROID_API = 28;

export function shouldRenderGadgetPattern(
  os: string,
  version: string | number
) {
  return os !== 'android' || Number(version) > MAX_LEGACY_ANDROID_API;
}
