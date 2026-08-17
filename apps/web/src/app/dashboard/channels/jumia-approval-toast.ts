function pluralizeProducts(count: number): string {
  return `${count} product${count === 1 ? '' : 's'}`;
}

export function buildJumiaApprovalToastMessage(data: {
  updated?: number;
  pending?: number;
  failed?: number;
}): string {
  const updated = data.updated ?? 0;
  const pending = data.pending ?? 0;
  const failed = data.failed ?? 0;
  const parts: string[] = [];

  if (updated > 0) {
    parts.push(
      `${pluralizeProducts(updated)} approved and ready for stock sync`
    );
  }
  if (pending > 0) {
    parts.push(`${pluralizeProducts(pending)} still pending Jumia approval`);
  }
  if (failed > 0) {
    parts.push(`${pluralizeProducts(failed)} were rejected by Jumia`);
  }

  if (parts.length === 0) {
    return 'No pending Jumia product feeds found';
  }

  return parts.join('; ');
}
