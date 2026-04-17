function normalizeRoundedChange(value: number) {
  if (!Number.isFinite(value)) return 0;

  const rounded = (Math.sign(value) * Math.round(Math.abs(value) * 10)) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatMetricChange(value: number) {
  const normalized = normalizeRoundedChange(value);

  if (normalized === 0) {
    return '0%';
  }

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(normalized) ? 0 : 1,
    maximumFractionDigits: 1,
  });

  return `${normalized > 0 ? '+' : ''}${formatter.format(normalized)}%`;
}
