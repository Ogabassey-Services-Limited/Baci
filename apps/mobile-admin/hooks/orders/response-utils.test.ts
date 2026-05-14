import { describe, expect, it } from 'vitest';
import { parseResponsePayload } from './response-utils';

describe('parseResponsePayload', () => {
  it('returns null for an empty response body', () => {
    expect(parseResponsePayload('')).toBeNull();
  });

  it('parses JSON object payloads', () => {
    expect(parseResponsePayload('{"error":"failed"}')).toEqual({
      error: 'failed',
    });
  });

  it('parses nested JSON object payloads with surrounding whitespace', () => {
    expect(parseResponsePayload('  {"data":{"nested":"value"}}  ')).toEqual({
      data: { nested: 'value' },
    });
  });

  it('returns raw text for JSON arrays and primitives', () => {
    expect(parseResponsePayload('[1,2,3]')).toBe('[1,2,3]');
    expect(parseResponsePayload('true')).toBe('true');
    expect(parseResponsePayload('42')).toBe('42');
    expect(parseResponsePayload('null')).toBe('null');
  });

  it('returns raw text when the response body is not JSON', () => {
    expect(parseResponsePayload('sent')).toBe('sent');
    expect(parseResponsePayload('{"incomplete')).toBe('{"incomplete');
  });
});
