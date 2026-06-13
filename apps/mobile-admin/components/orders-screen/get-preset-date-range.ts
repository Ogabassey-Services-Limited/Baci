export function getPresetDateRange(preset: string) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (preset) {
    case 'Yesterday':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end = new Date(start);
      break;
    case 'Last 7 Days':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      end = new Date(now);
      break;
    case 'Last 30 Days':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      end = new Date(now);
      break;
    case 'This Month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
  }

  return { start, end };
}
