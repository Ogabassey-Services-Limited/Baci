import assert from 'node:assert/strict';
import {
  closeSync,
  ftruncateSync,
  mkdtempSync,
  openSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  MAX_JSONL_READ_BYTES,
  readJsonlLogEvents,
} from './vercel-error-events.mjs';

describe('Vercel JSONL drain reader', () => {
  it('reads recent events from a sparse drain beyond the string limit', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-vercel-events-'));
    const path = join(directory, 'drain.jsonl');
    const descriptor = openSync(path, 'w');
    try {
      const event = JSON.stringify({
        level: 'error',
        message: 'Error: recent event',
        route: '/api/recent',
      });
      const eventBytes = Buffer.from(`${event}\n`);
      const size = 513 * 1024 * 1024;
      ftruncateSync(descriptor, size);
      writeSync(
        descriptor,
        Buffer.from('\n'),
        0,
        1,
        size - eventBytes.length - 1
      );
      writeSync(
        descriptor,
        eventBytes,
        0,
        eventBytes.length,
        size - eventBytes.length
      );

      assert.deepEqual(readJsonlLogEvents(path), [JSON.parse(event)]);
    } finally {
      closeSync(descriptor);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps a record when the bounded tail starts on a line boundary', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-vercel-events-'));
    const path = join(directory, 'drain.jsonl');
    try {
      const event = JSON.stringify({
        level: 'error',
        message: 'Error: boundary event',
        route: '/api/boundary',
      });
      const eventBytes = Buffer.from(`${event}\n`);
      const size = MAX_JSONL_READ_BYTES + eventBytes.length;
      const descriptor = openSync(path, 'w');
      ftruncateSync(descriptor, size);
      writeSync(descriptor, Buffer.from('\n'), 0, 1, eventBytes.length - 1);
      writeSync(
        descriptor,
        eventBytes,
        0,
        eventBytes.length,
        eventBytes.length
      );
      writeSync(
        descriptor,
        Buffer.alloc(MAX_JSONL_READ_BYTES - eventBytes.length, 0x20),
        0,
        MAX_JSONL_READ_BYTES - eventBytes.length,
        eventBytes.length * 2
      );
      closeSync(descriptor);

      assert.deepEqual(readJsonlLogEvents(path), [JSON.parse(event)]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
