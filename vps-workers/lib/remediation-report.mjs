function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function parseRecipients(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

export function buildRemediationReport({
  actions = [],
  candidates = [],
  mode = 'dry-run',
  policy = { allowed: false, reasons: [] },
} = {}) {
  const subject = `Baci Vercel remediation ${mode}: ${candidates.length} candidate(s)`;
  const candidateLines = candidates.map((candidate) => {
    const sample = candidate.sample || {};
    return [
      `fingerprint=${candidate.fingerprint}`,
      `occurrences=${candidate.occurrences}`,
      `route=${sample.route || '(unknown)'}`,
      `deployment=${sample.deploymentId || '(unknown)'}`,
      `message=${sample.message || '(empty)'}`,
    ].join(' | ');
  });
  const actionLines = actions.map((action) =>
    `${action.type}: ${action.path || action.detail || ''}`.trim()
  );
  const policyLines = policy.allowed
    ? ['auto-merge policy: allowed']
    : ['auto-merge policy: blocked', ...policy.reasons];

  const text = [
    `Mode: ${mode}`,
    '',
    'Candidates:',
    ...(candidateLines.length ? candidateLines : ['none']),
    '',
    'Actions:',
    ...(actionLines.length ? actionLines : ['none']),
    '',
    'Policy:',
    ...policyLines,
  ].join('\n');

  const html = `
    <h1>Baci Vercel remediation</h1>
    <p><strong>Mode:</strong> ${escapeHtml(mode)}</p>
    <h2>Candidates</h2>
    <ul>${(candidateLines.length ? candidateLines : ['none'])
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join('')}</ul>
    <h2>Actions</h2>
    <ul>${(actionLines.length ? actionLines : ['none'])
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join('')}</ul>
    <h2>Policy</h2>
    <ul>${policyLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
  `;

  return { html, subject, text };
}

export async function sendRemediationReportEmail({
  env = process.env,
  fetchFn = fetch,
  report,
}) {
  const recipients = parseRecipients(env.BACI_REMEDIATION_NOTIFY_EMAILS);
  const token = env.ZEPTOMAIL_TOKEN;
  const fromDomain = env.ZEPTOMAIL_FROM_DOMAIN || 'usebaci.com';
  if (recipients.length === 0 || !token) {
    return { skipped: true, reason: 'email not configured' };
  }

  const response = await fetchFn('https://api.zeptomail.com/v1.1/email', {
    body: JSON.stringify({
      from: {
        address: `notifications@${fromDomain}`,
        name: 'Baci Ops',
      },
      htmlbody: report.html,
      subject: report.subject,
      textbody: report.text,
      to: recipients.map((address) => ({
        email_address: { address },
      })),
    }),
    headers: {
      Authorization: `Zoho-enczapikey ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `ZeptoMail report failed with HTTP ${response.status}: ${body.slice(0, 500)}`
    );
  }

  return { skipped: false, recipients: recipients.length };
}
