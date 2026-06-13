export function formatTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
