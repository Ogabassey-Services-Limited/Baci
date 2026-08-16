import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractCodexResearchText,
  validateCodexResearchResult,
} from './remediation-research-gate.mjs';

const validReport = [
  'RESEARCH_SUMMARY: traced the failure to the bounded parser.',
  'ROOT_CAUSE_CONFIDENCE: medium',
  'OPTIONS_CONSIDERED:',
  '- smallest code fix',
  '- operational mitigation',
  'SELECTED_FIX: smallest code fix',
  'VALIDATION_PLAN: run the focused regression suite',
].join('\n');

const jsonl = (text) =>
  `${JSON.stringify({ type: 'item.completed', item: { text } })}\n${JSON.stringify({ type: 'turn.completed' })}\n`;

describe('remediation research gate', () => {
  it('accepts a complete defensible structured report', () => {
    const result = validateCodexResearchResult(jsonl(validReport));

    assert.equal(result.accepted, true);
    assert.deepEqual(result.reasons, []);
    assert.match(result.text, /SELECTED_FIX/);
  });

  it('rejects an unstructured report before implementation can start', () => {
    const result = validateCodexResearchResult(
      jsonl('The fix is probably safe.')
    );

    assert.equal(result.accepted, false);
    assert.match(result.reasons.join('\n'), /RESEARCH_SUMMARY/);
    assert.match(result.reasons.join('\n'), /VALIDATION_PLAN/);
  });

  it('rejects a report that selects no defensible fix', () => {
    const report = validReport.replace(
      'SELECTED_FIX: smallest code fix',
      'SELECTED_FIX: no defensible fix is established'
    );

    const result = validateCodexResearchResult(jsonl(report));

    assert.equal(result.accepted, false);
    assert.match(result.reasons.join('\n'), /defensible selected fix/);
  });

  it('extracts text from Codex content blocks without trusting other events', () => {
    const output = [
      JSON.stringify({
        type: 'item.completed',
        item: { content: [{ text: 'RESEARCH_SUMMARY: bounded' }] },
      }),
      JSON.stringify({ type: 'turn.completed' }),
    ].join('\n');

    assert.equal(extractCodexResearchText(output), 'RESEARCH_SUMMARY: bounded');
  });
});
