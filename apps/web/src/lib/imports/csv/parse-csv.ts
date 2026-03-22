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

  currentRow.push(currentValue);
  if (currentRow.some((value) => value.trim().length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

export function parseCsvText(text: string): ParsedCsv {
  const lineItems = parseCsvLineItems(text);
  if (lineItems.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lineItems[0].map(normalizeHeader);
  const rows = lineItems.slice(1).map((line) => {
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = (line[index] || '').trim();
    });

    return row;
  });

  return { headers, rows };
}
