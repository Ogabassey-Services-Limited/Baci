type SqlArrayFieldGroup = 'exact' | 'presence' | 'ignored' | 'forbidden';

export function extractSqlArrayFields(
  triggerFunctionSql: string,
  fieldGroup: SqlArrayFieldGroup
): string[] {
  const declarationMarker = `v_${fieldGroup}_fields text[] := ARRAY[`;
  const declarationStart = triggerFunctionSql.indexOf(declarationMarker);
  if (declarationStart === -1) return [];

  const valuesStart = declarationStart + declarationMarker.length;
  const valuesEndMarker = ']::text[];';
  const valuesEnd = triggerFunctionSql.indexOf(valuesEndMarker, valuesStart);
  if (valuesEnd === -1) return [];

  return triggerFunctionSql
    .slice(valuesStart, valuesEnd)
    .split(',')
    .flatMap((value) => {
      const field = value.trim();
      return field.startsWith("'") && field.endsWith("'")
        ? [field.slice(1, -1)]
        : [];
    });
}
