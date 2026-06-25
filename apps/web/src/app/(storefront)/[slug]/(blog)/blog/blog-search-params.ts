export type BlogSearchParamValue = string | string[] | undefined;

export function toSingleBlogSearchParam(
  value: BlogSearchParamValue
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
