export function isPresentString(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}
