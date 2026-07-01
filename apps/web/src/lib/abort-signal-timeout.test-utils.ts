const originalAbortSignalTimeoutDescriptor = Object.getOwnPropertyDescriptor(
  AbortSignal,
  'timeout'
);

export function restoreAbortSignalTimeout() {
  if (originalAbortSignalTimeoutDescriptor) {
    Object.defineProperty(
      AbortSignal,
      'timeout',
      originalAbortSignalTimeoutDescriptor
    );
  }
}

export function removeNativeAbortSignalTimeout() {
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: undefined,
  });
}
