interface ClaimPreview {
  claim: {
    claimed: boolean;
    customerName: string | null;
    devices: string[];
    merchantName: string;
  };
}

export function readClaimError(
  data: ClaimPreview | { error?: string },
  fallback: string
) {
  return 'error' in data && typeof data.error === 'string'
    ? data.error
    : fallback;
}

export function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export function joinBasePath(basePath: string | undefined, path: string) {
  return `${basePath || ''}${path}`;
}

export function createDeviceListItems(devices: string[]) {
  const occurrences = new Map<string, number>();

  return devices.map((device) => {
    const count = (occurrences.get(device) ?? 0) + 1;
    occurrences.set(device, count);

    return {
      device,
      key: `${device}-${count}`,
    };
  });
}
