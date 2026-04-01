interface FlightLock {
  current: boolean;
}

export async function runSingleFlight<T>(
  lock: FlightLock,
  operation: () => Promise<T>
): Promise<T | undefined> {
  if (lock.current) {
    return undefined;
  }

  lock.current = true;

  try {
    return await operation();
  } finally {
    lock.current = false;
  }
}
