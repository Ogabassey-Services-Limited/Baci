export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

function normalizeHeader(value: string) {
  return value.trim().replace(/^\uFEFF/, '');
}

function parseCsvLineItems(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === ',' && !insideQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !insideQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      currentRow.push(currentValue);
      currentValue = '';

      const hasContent = currentRow.some((value) => value.trim().length > 0);
      if (hasContent) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentValue += character;
  }

  if (insideQuotes) {
    throw new Error('Malformed CSV: unterminated quoted field');
  }

  currentRow.push(currentValue);
  if (currentRow.some((value) => value.trim().length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function validateHeaders(rawHeaders: string[], normalizedHeaders: string[]) {
  const emptyHeaders = normalizedHeaders
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.length === 0);

  if (emptyHeaders.length > 0) {
    throw new Error(
      `Malformed CSV headers: empty header at column ${emptyHeaders[0].index + 1}`
    );
  }

  const seen = new Map<string, number>();
  for (const [index, header] of normalizedHeaders.entries()) {
    if (!seen.has(header)) {
      seen.set(header, index);
      continue;
    }

    const firstIndex = seen.get(header) ?? 0;
    throw new Error(
      `Malformed CSV headers: duplicate header "${rawHeaders[index] || header}" at columns ${firstIndex + 1} and ${index + 1}`
    );
  }
}

export function parseCsvText(text: string): ParsedCsv {
  const lineItems = parseCsvLineItems(text);
  if (lineItems.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = lineItems[0];
  const headers = rawHeaders.map(normalizeHeader);
  validateHeaders(rawHeaders, headers);
  const rows = lineItems.slice(1).map((line) => {
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = (line[index] || '').trim();
    });

    return row;
  });

  return { headers, rows };
}
