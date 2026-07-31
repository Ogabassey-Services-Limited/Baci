import type { MutateOptions } from '@tanstack/react-query';
import type { BuilderMutationVariables } from './builder-ai-request';

export type BuilderMerchantRequest = {
  merchantId: string | null;
  revision: number;
};

export type BuilderMutationCallbacks = MutateOptions<
  void,
  Error,
  BuilderMutationVariables,
  void
>;

type BuilderMerchantRequestRef = { current: BuilderMerchantRequest };

export function guardBuilderMutationCallbacks(
  callbacks: BuilderMutationCallbacks | undefined,
  request: BuilderMerchantRequest,
  activeRequestRef: BuilderMerchantRequestRef
): BuilderMutationCallbacks | undefined {
  if (!callbacks) return undefined;

  const isActiveRequest = () =>
    activeRequestRef.current.merchantId === request.merchantId &&
    activeRequestRef.current.revision === request.revision;

  return {
    onError: callbacks.onError
      ? (error, variables, onMutateResult, context) => {
          if (isActiveRequest()) {
            callbacks.onError?.(error, variables, onMutateResult, context);
          }
        }
      : undefined,
    onSettled: callbacks.onSettled
      ? (data, error, variables, onMutateResult, context) => {
          if (isActiveRequest()) {
            callbacks.onSettled?.(
              data,
              error,
              variables,
              onMutateResult,
              context
            );
          }
        }
      : undefined,
    onSuccess: callbacks.onSuccess
      ? (data, variables, onMutateResult, context) => {
          if (isActiveRequest()) {
            callbacks.onSuccess?.(data, variables, onMutateResult, context);
          }
        }
      : undefined,
  };
}
