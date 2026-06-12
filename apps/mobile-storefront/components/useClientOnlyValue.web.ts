import { useSyncExternalStore } from 'react';

// The store never changes, so subscribers are never notified.
const subscribeToNothing = () => () => undefined;

// `getServerSnapshot` is only used during server rendering and hydration,
// meaning we can use this to determine if we're on the server or not.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return useSyncExternalStore<S | C>(
    subscribeToNothing,
    () => client,
    () => server
  );
}
