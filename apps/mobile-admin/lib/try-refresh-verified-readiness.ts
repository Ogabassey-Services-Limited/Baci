export async function tryRefreshVerifiedReadiness(
  refresh: () => Promise<unknown>
): Promise<boolean> {
  try {
    await refresh();
    return true;
  } catch {
    return false;
  }
}
