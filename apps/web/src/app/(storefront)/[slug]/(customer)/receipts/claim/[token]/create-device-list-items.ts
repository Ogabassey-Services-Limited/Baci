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
