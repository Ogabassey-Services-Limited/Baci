interface PublicPuckThemeTokenLease {
  release: () => void;
}

interface InlineToken {
  priority: string;
  value: string;
}

interface RootLeaseState {
  baseline: Map<string, InlineToken>;
  leases: Map<symbol, Record<string, string>>;
  lastApplied: Map<string, InlineToken>;
}

const rootLeaseStates = new WeakMap<HTMLElement, RootLeaseState>();

function readInlineToken(root: HTMLElement, name: string): InlineToken {
  return {
    priority: root.style.getPropertyPriority(name),
    value: root.style.getPropertyValue(name),
  };
}

function matchesInlineToken(
  first: InlineToken | undefined,
  second: InlineToken | undefined
) {
  return first?.value === second?.value && first?.priority === second?.priority;
}

function getLatestProjection(
  leases: Map<symbol, Record<string, string>>
): Record<string, string> | null {
  let latest: Record<string, string> | null = null;
  for (const projection of leases.values()) latest = projection;
  return latest;
}

function applyProjection(
  root: HTMLElement,
  state: RootLeaseState,
  projection: Record<string, string>,
  preserveNewerRootValues = false
) {
  for (const [name, value] of Object.entries(projection)) {
    if (
      preserveNewerRootValues &&
      !matchesInlineToken(
        readInlineToken(root, name),
        state.lastApplied.get(name)
      )
    ) {
      continue;
    }
    root.style.setProperty(name, value);
    state.lastApplied.set(name, readInlineToken(root, name));
  }
}

function restoreBaseline(root: HTMLElement, state: RootLeaseState) {
  for (const [name, token] of state.baseline) {
    if (
      !matchesInlineToken(
        readInlineToken(root, name),
        state.lastApplied.get(name)
      )
    ) {
      continue;
    }
    if (token.value) {
      root.style.setProperty(name, token.value, token.priority);
    } else {
      root.style.removeProperty(name);
    }
  }
}

/**
 * Temporarily exposes a public storefront's Puck tokens to Radix portals.
 * The latest active lease wins; final cleanup restores only values it owns.
 */
export function leasePublicPuckThemeTokens(
  root: HTMLElement,
  projection: Record<string, string>
): PublicPuckThemeTokenLease {
  let state = rootLeaseStates.get(root);
  if (!state) {
    state = {
      baseline: new Map(
        Object.keys(projection).map((name) => [
          name,
          readInlineToken(root, name),
        ])
      ),
      leases: new Map(),
      lastApplied: new Map(),
    };
    rootLeaseStates.set(root, state);
  }

  const leaseId = Symbol('public-puck-theme-token-lease');
  state.leases.set(leaseId, projection);
  applyProjection(root, state, projection);

  return {
    release: () => {
      const activeState = rootLeaseStates.get(root);
      if (!activeState) return;
      if (!activeState.leases.delete(leaseId)) return;

      const latestProjection = getLatestProjection(activeState.leases);
      if (latestProjection) {
        applyProjection(root, activeState, latestProjection, true);
        return;
      }

      restoreBaseline(root, activeState);
      rootLeaseStates.delete(root);
    },
  };
}
