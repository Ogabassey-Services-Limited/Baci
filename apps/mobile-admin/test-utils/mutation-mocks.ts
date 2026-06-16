export type MutationConfig = {
  mutationFn: (variables: unknown) => Promise<unknown>;
  onSuccess?: (
    data: unknown,
    variables: unknown,
    onMutateResult: unknown,
    context: unknown
  ) => unknown;
};
