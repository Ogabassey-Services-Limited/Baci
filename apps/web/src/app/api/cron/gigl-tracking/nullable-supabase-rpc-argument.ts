/**
 * Supabase's generated function arguments cannot describe SQL's default
 * nullable input semantics. Preserve an intentional SQL NULL at runtime while
 * keeping callers aligned with the generated string argument shape.
 */
export function nullableSupabaseRpcArgument(value: string | null): string {
  return value as string;
}
