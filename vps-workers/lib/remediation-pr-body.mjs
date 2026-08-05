export function buildRemediationPrBody(candidate) {
  const sample = candidate.sample || {};
  const safe = (value, length = 160) =>
    String(value || '(unknown)')
      .replace(/[\r\n<>]/g, ' ')
      .slice(0, length);
  return [
    'Automated draft PR from the Baci production error remediator.',
    '',
    `Fingerprint: ${safe(candidate.fingerprint, 80)}`,
    `Occurrences: ${Number(candidate.occurrences) || 0}`,
    `Route: ${safe(sample.route, 240)}`,
    `Deployment: ${safe(sample.deploymentId)}`,
    `Request: ${safe(sample.requestId)}`,
    `Source: ${safe(sample.source || 'vercel', 80)}`,
    `Release: ${safe(sample.release)}`,
    '',
    'The worker is policy-gated. Protected files require human handling.',
  ].join('\n');
}
