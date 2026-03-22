export function statusBadgeClass(status: string) {
  if (status === 'completed' || status === 'committed') {
    return 'bg-emerald-500/10 text-emerald-700';
  }

  if (status === 'failed') {
    return 'bg-rose-500/10 text-rose-700';
  }

  if (
    [
      'uploaded',
      'validating',
      'commit_queued',
      'committing',
      'notify_queued',
      'notifying',
    ].includes(status)
  ) {
    return 'bg-blue-500/10 text-blue-700';
  }

  return 'bg-muted text-muted-foreground';
}
