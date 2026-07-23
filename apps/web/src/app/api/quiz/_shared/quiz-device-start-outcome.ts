export function interpretQuizDeviceStartOutcome(
  data: unknown,
  hasDeviceHash: boolean
) {
  if (!hasDeviceHash || !data || typeof data !== 'object') {
    return {
      deviceAllowed: undefined,
      deviceBindingFailed: undefined,
      startData: data,
    };
  }

  const { deviceAllowed, deviceBindingFailed, ...startData } = data as Record<
    string,
    unknown
  >;
  return { deviceAllowed, deviceBindingFailed, startData };
}
