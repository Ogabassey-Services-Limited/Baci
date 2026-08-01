import {
  INVENTORY_COLUMNS,
  PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER,
  type ProductDescriptionWriterInventoryRow,
} from './product-description-writer-inventory';

function escapeCsv(value: string): string {
  return /[",\r\n]/.test(value)
    ? `"${value.replaceAll('"', '""')}"`
    : value;
}

export function buildProductDescriptionWriterInventoryCsv(
  rows: ProductDescriptionWriterInventoryRow[]
): string {
  if (rows.length === 0) {
    return `${PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER}\n`;
  }

  return `${PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER}\n${rows
    .map((entry) =>
      INVENTORY_COLUMNS.map((column) => escapeCsv(entry[column])).join(',')
    )
    .join('\n')}\n`;
}

export function parseProductDescriptionWriterInventoryCsv(
  csv: string
): { errors: string[]; rows: ProductDescriptionWriterInventoryRow[] } {
  const fields: string[][] = [[]];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (quoted && char === '"' && next === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      if (!quoted && field) {
        return { errors: ['Inventory CSV contains an invalid quote'], rows: [] };
      }
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ',') {
      fields.at(-1)?.push(field);
      field = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1;
      fields.at(-1)?.push(field);
      field = '';
      fields.push([]);
      continue;
    }
    field += char;
  }

  if (quoted) {
    return {
      errors: ['Inventory CSV contains an unterminated quoted field'],
      rows: [],
    };
  }
  fields.at(-1)?.push(field);
  if (fields.at(-1)?.length === 1 && fields.at(-1)?.[0] === '') fields.pop();
  if (fields[0]?.join(',') !== PRODUCT_DESCRIPTION_WRITER_INVENTORY_HEADER) {
    return {
      errors: ['Inventory CSV header does not match the required schema'],
      rows: [],
    };
  }

  try {
    const rows = fields.slice(1).map((values, index) => {
      if (values.length !== INVENTORY_COLUMNS.length) {
        throw new Error(
          `Inventory CSV row ${index + 2} does not match the required schema`
        );
      }
      return Object.fromEntries(
        INVENTORY_COLUMNS.map((column, valueIndex) => [
          column,
          values[valueIndex],
        ])
      ) as ProductDescriptionWriterInventoryRow;
    });
    return { errors: [], rows };
  } catch (error) {
    return {
      errors: [
        error instanceof Error
          ? error.message
          : 'Inventory CSV does not match the required schema',
      ],
      rows: [],
    };
  }
}
