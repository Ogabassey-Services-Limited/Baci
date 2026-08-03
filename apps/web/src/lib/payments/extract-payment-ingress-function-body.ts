export function extractPaymentIngressFunctionBody(
  migrationSql: string,
  functionName: string
): string {
  const functionMarker = `CREATE OR REPLACE FUNCTION private.${functionName}(`;
  const functionStart = migrationSql.indexOf(functionMarker);
  if (functionStart === -1) {
    throw new Error(`missing payment ingress function body: ${functionName}`);
  }

  const bodyMarker = 'AS $$';
  const bodyStart = migrationSql.indexOf(
    bodyMarker,
    functionStart + functionMarker.length
  );
  if (bodyStart === -1) {
    throw new Error(`missing payment ingress function body: ${functionName}`);
  }

  const bodyEndMarker = '$$;';
  const bodyEnd = migrationSql.indexOf(
    bodyEndMarker,
    bodyStart + bodyMarker.length
  );
  if (bodyEnd === -1) {
    throw new Error(`missing payment ingress function body: ${functionName}`);
  }

  return migrationSql.slice(bodyStart + bodyMarker.length, bodyEnd);
}
