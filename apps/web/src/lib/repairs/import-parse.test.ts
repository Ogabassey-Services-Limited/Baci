import { describe, expect, it } from 'vitest';
import {
  buildRepairImportPrompt,
  chunkImportText,
  parseRepairImportResponse,
} from './import-parse';

describe('chunkImportText', () => {
  it('returns a single chunk for short text', () => {
    const chunks = chunkImportText('iPhone 12 screen 25000', 1200);
    expect(chunks).toHaveLength(1);
  });

  it('splits long text on line boundaries without splitting a line', () => {
    const line = 'Samsung Galaxy S21 screen replacement 45000';
    const text = Array.from({ length: 100 }, () => line).join('\n');
    const chunks = chunkImportText(text, 400);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(400 + line.length);
      for (const chunkLine of chunk.split('\n')) {
        expect(chunkLine === '' || chunkLine === line).toBe(true);
      }
    }
  });

  it('keeps an over-long single line as its own chunk', () => {
    const longLine = 'x'.repeat(500);
    const chunks = chunkImportText(longLine, 100);
    expect(chunks).toEqual([longLine]);
  });
});

describe('buildRepairImportPrompt', () => {
  it('embeds the chunk text and asks for JSON rows', () => {
    const prompt = buildRepairImportPrompt('iPhone 12 screen 25000');
    expect(prompt).toContain('iPhone 12 screen 25000');
    expect(prompt.toLowerCase()).toContain('json');
    expect(prompt).toContain('repair_type');
  });
});

describe('parseRepairImportResponse', () => {
  it('parses valid rows and normalizes prices', () => {
    const rows = parseRepairImportResponse(
      JSON.stringify({
        rows: [
          {
            brand: 'Apple',
            model: 'iPhone 12',
            repair_type: 'Screen',
            price: '₦25,000',
          },
          {
            brand: 'Samsung',
            model: 'S21',
            repair_type: 'Battery',
            price: 18000,
            part_quality: 'OEM',
          },
        ],
      })
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      brand: 'Apple',
      model: 'iPhone 12',
      repairType: 'Screen',
      price: 25000,
    });
    expect(rows[1]?.partQuality).toBe('OEM');
  });

  it('strips markdown code fences before parsing', () => {
    const content =
      '```json\n{"rows":[{"brand":"Apple","model":"X","repair_type":"Screen","price":10000}]}\n```';
    const rows = parseRepairImportResponse(content);
    expect(rows).toHaveLength(1);
  });

  it('drops rows with an unparseable price', () => {
    const rows = parseRepairImportResponse(
      JSON.stringify({
        rows: [
          {
            brand: 'Apple',
            model: 'X',
            repair_type: 'Screen',
            price: 'call us',
          },
          { brand: 'Apple', model: 'Y', repair_type: 'Screen', price: 9000 },
        ],
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.model).toBe('Y');
  });

  it('throws on non-JSON content', () => {
    expect(() => parseRepairImportResponse('not json at all')).toThrow();
  });

  it('throws on empty content', () => {
    expect(() => parseRepairImportResponse('')).toThrow();
  });
});
