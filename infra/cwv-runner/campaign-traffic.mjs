const COUNTERS = Object.freeze([
  'forwardedIngress',
  'measurementIngress',
  'hostLocalIngress',
  'forwardedEgress',
  'measurementEgress',
  'hostOriginatedEgress',
]);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_UINT64 = (1n << 64n) - 1n;

function unsigned(value, label) {
  const validNumber = Number.isSafeInteger(value) && value >= 0;
  const validText =
    typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value);
  if (!validNumber && !validText)
    throw new Error(`malformed counter: ${label}`);
  const parsed = BigInt(value);
  if (parsed > MAX_UINT64) throw new Error(`counter overflow: ${label}`);
  return parsed;
}

function requiredCounters(value, side) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`malformed ${side} counters`);
  for (const key of COUNTERS) {
    if (!Object.hasOwn(value, key)) throw new Error(`missing counter: ${key}`);
  }
  const extra = Object.keys(value).filter((key) => !COUNTERS.includes(key));
  if (extra.length > 0) throw new Error(`unexpected counter: ${extra[0]}`);
  return Object.fromEntries(
    COUNTERS.map((key) => [key, unsigned(value[key], `${side}.${key}`)])
  );
}

function safeNumber(value, label) {
  if (value > MAX_SAFE) throw new Error(`${label} overflow`);
  return Number(value);
}

export function calculateTrafficDeltas({ start, end }) {
  const before = requiredCounters(start, 'start');
  const after = requiredCounters(end, 'end');
  const delta = {};
  for (const key of COUNTERS) {
    if (after[key] < before[key])
      throw new Error(`counter reset or wrap: ${key}`);
    delta[key] = after[key] - before[key];
  }
  if (delta.measurementIngress > delta.forwardedIngress)
    throw new Error('measurement ingress exceeds forwarded ingress');
  if (delta.measurementEgress > delta.forwardedEgress)
    throw new Error('measurement egress exceeds forwarded egress');
  return {
    ambientIngressBytes: safeNumber(
      delta.forwardedIngress -
        delta.measurementIngress +
        delta.hostLocalIngress,
      'ambient ingress'
    ),
    ambientEgressBytes: safeNumber(
      delta.forwardedEgress -
        delta.measurementEgress +
        delta.hostOriginatedEgress,
      'ambient egress'
    ),
    measurementIngressBytes: safeNumber(
      delta.measurementIngress,
      'measurement ingress'
    ),
    measurementEgressBytes: safeNumber(
      delta.measurementEgress,
      'measurement egress'
    ),
  };
}

function thresholdProduct(value, seconds) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error('malformed network threshold');
  const product = BigInt(value) * BigInt(seconds);
  return safeNumber(product, 'threshold product');
}

export function evaluateTrafficInterval(options) {
  const { start, end, intervalSeconds, thresholds } = options;
  const sampleSeconds = thresholds?.networkSampleSeconds;
  if (!Number.isSafeInteger(sampleSeconds) || sampleSeconds <= 0)
    throw new Error('malformed network sample interval');
  if (intervalSeconds !== sampleSeconds)
    throw new Error(`interval must equal ${sampleSeconds} seconds`);
  const ingressLimitBytes = thresholdProduct(
    thresholds.networkRxBytesPerSecondMax,
    sampleSeconds
  );
  const egressLimitBytes = thresholdProduct(
    thresholds.networkTxBytesPerSecondMax,
    sampleSeconds
  );
  const traffic = calculateTrafficDeltas({ start, end });
  if (traffic.ambientIngressBytes > ingressLimitBytes)
    throw new Error('ambient ingress exceeds threshold');
  if (traffic.ambientEgressBytes > egressLimitBytes)
    throw new Error('ambient egress exceeds threshold');
  return { ...traffic, ingressLimitBytes, egressLimitBytes };
}
