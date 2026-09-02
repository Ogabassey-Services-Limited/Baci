type JumiaIntegrationRef = { id: string };

export function resolveJumiaIntegrationId(
  integrations: readonly JumiaIntegrationRef[],
  requestedIntegrationId: string | null
): string | null {
  if (requestedIntegrationId) {
    return integrations.some(
      (integration) => integration.id === requestedIntegrationId
    )
      ? requestedIntegrationId
      : null;
  }

  return integrations.length === 1 ? integrations[0].id : null;
}
