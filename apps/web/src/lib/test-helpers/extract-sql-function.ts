export function extractSqlFunction(
  migrationSql: string,
  functionName: string
): string {
  const functionMarker = `CREATE OR REPLACE FUNCTION ${functionName}`;
  const functionStart = migrationSql.indexOf(functionMarker);
  if (functionStart === -1) return '';

  const functionEndMarker = '\n$$;';
  const functionEnd = migrationSql.indexOf(
    functionEndMarker,
    functionStart + functionMarker.length
  );
  if (functionEnd === -1) return '';

  return migrationSql.slice(
    functionStart,
    functionEnd + functionEndMarker.length
  );
}
