function splitCsvRecord(record: string) {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];
    const nextCharacter = record[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      fields.push(field);
      field = '';
      continue;
    }

    field += character;
  }

  fields.push(field);
  return fields;
}

function splitCsvRecords(csv: string) {
  const records: string[] = [];
  let record = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      record += '""';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (record.trim().length > 0) {
        records.push(record);
      }
      record = '';

      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }
      continue;
    }

    record += character;
  }

  if (record.trim().length > 0) {
    records.push(record);
  }

  return records;
}

export function parseSemrushCsvPageUrls(csv: string) {
  const [headerRecord, ...records] = splitCsvRecords(csv);

  if (!headerRecord) {
    return [];
  }

  const headers = splitCsvRecord(headerRecord).map((header) => header.trim());
  const pageUrlIndex = headers.findIndex(
    (header) => header.toLowerCase() === 'page url'
  );

  if (pageUrlIndex < 0) {
    throw new Error('CSV is missing a Page URL column');
  }

  return records
    .map((record) => splitCsvRecord(record)[pageUrlIndex]?.trim() ?? '')
    .filter((url) => url.length > 0);
}
