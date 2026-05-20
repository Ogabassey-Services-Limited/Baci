import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRemediationReport,
  sendRemediationReportEmail,
} from './remediation-report.mjs';

describe('remediation report', () => {
  it('builds a concise operator report', () => {
    const report = buildRemediationReport({
      mode: 'dry-run',
      candidates: [
        {
          fingerprint: 'abc123',
          occurrences: 4,
          firstSeen: '2026-05-19T10:00:00.000Z',
          lastSeen: '2026-05-19T10:05:00.000Z',
          sample: {
            route: '/api/products',
            message: 'TypeError: Cannot read properties of undefined',
            deploymentId: 'dpl_123',
          },
        },
      ],
      actions: [{ type: 'prompt_written', path: '/tmp/prompt.md' }],
      policy: { allowed: false, reasons: ['dry run'] },
    });

    assert.match(report.subject, /Baci Vercel remediation/);
    assert.match(report.text, /abc123/);
    assert.match(report.text, /prompt_written/);
    assert.match(report.html, /TypeError/);
  });

  it('skips email when notification env is incomplete', async () => {
    const result = await sendRemediationReportEmail({
      report: { subject: 'Subject', text: 'Text', html: '<p>Text</p>' },
      env: {},
      fetchFn: () => {
        throw new Error('should not send');
      },
    });

    assert.deepEqual(result, { skipped: true, reason: 'email not configured' });
  });

  it('sends email through ZeptoMail when configured', async () => {
    const calls = [];
    const result = await sendRemediationReportEmail({
      report: { subject: 'Subject', text: 'Text', html: '<p>Text</p>' },
      env: {
        BACI_REMEDIATION_NOTIFY_EMAILS: 'owner@example.com,ops@example.com',
        ZEPTOMAIL_TOKEN: 'token',
        ZEPTOMAIL_FROM_DOMAIN: 'usebaci.com',
      },
      fetchFn: (url, init) => {
        calls.push({ url, init });
        return new Response('{}', { status: 200 });
      },
    });

    assert.deepEqual(result, { skipped: false, recipients: 2 });
    assert.equal(calls[0].url, 'https://api.zeptomail.com/v1.1/email');
    assert.equal(calls[0].init.headers.Authorization, 'Zoho-enczapikey token');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.to.length, 2);
    assert.equal(body.from.address, 'notifications@usebaci.com');
  });
});
