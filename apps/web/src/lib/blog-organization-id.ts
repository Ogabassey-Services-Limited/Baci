export function buildBlogOrganizationId(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}#organization`;
}
