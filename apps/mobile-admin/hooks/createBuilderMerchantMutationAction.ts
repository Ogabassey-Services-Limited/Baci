import type { BuilderMutationVariables } from './builder-ai-request';
import {
  type BuilderMerchantRequest,
  type BuilderMutationCallbacks,
  guardBuilderMutationCallbacks,
} from './builder-mutation-callbacks';

type BuilderMerchantMutation = {
  mutate: (
    variables: BuilderMutationVariables,
    options?: BuilderMutationCallbacks
  ) => void;
};

type BuilderMerchantRequestRef = { current: BuilderMerchantRequest };

export function createBuilderMerchantMutationAction(
  mutation: BuilderMerchantMutation,
  activeRequestRef: BuilderMerchantRequestRef
) {
  return (_variables?: undefined, options?: BuilderMutationCallbacks) => {
    const request = activeRequestRef.current;
    mutation.mutate(
      { merchantId: request.merchantId },
      guardBuilderMutationCallbacks(options, request, activeRequestRef)
    );
  };
}
