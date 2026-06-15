function normalizeRoundedChange(value: number) {
  if (!Number.isFinite(value)) return 0;

  const rounded = (Math.sign(value) * Math.round(Math.abs(value) * 10)) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

const _metricChangeFormatterCache = new Map<boolean, Intl.NumberFormat>();
function getMetricChangeFormatter(isInteger: boolean): Intl.NumberFormat {
  let formatter = _metricChangeFormatterCache.get(isInteger);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: isInteger ? 0 : 1,
      maximumFractionDigits: 1,
    });
    _metricChangeFormatterCache.set(isInteger, formatter);
  }
  return formatter;
}

export function formatMetricChange(value: number) {
  const normalized = normalizeRoundedChange(value);

  if (normalized === 0) {
    return '0%';
  }

  const formatter = getMetricChangeFormatter(Number.isInteger(normalized));

  return `${normalized > 0 ? '+' : ''}${formatter.format(normalized)}%`;
}
