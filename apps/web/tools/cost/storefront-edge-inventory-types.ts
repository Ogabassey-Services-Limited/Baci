type StorefrontEdgeDecision =
  | 'edge_redirect'
  | 'edge_release'
  | 'edge_terminal'
  | 'origin_dynamic';

type StorefrontEdgeInventoryRow = Readonly<{
  decision: StorefrontEdgeDecision;
  id: string;
  methods: readonly string[];
  reason: string;
  routePattern: string;
  sourceKind:
    | 'api_family'
    | 'machine_family'
    | 'proxy_path_class'
    | 'storefront_entrypoint';
  sourcePath?: string;
}>;

/** Deterministic Task 1A input sealed by the later Task 0A cost gate. */
export type StorefrontEdgeInventory = Readonly<{
  authority: 'directional_cost_screen_only';
  completeBrowserPathClasses: readonly string[];
  eligibleDenominatorPolicy: Readonly<{
    decisions: readonly StorefrontEdgeDecision[];
    methods: readonly string[];
    scope: string;
    zeroDenominatorVerdict: 'NOT_PROVEN';
  }>;
  inventorySha256: string;
  originMainSha: string;
  pilotCandidateHostnameSha256: string;
  pilotCandidateHostnames: readonly string[];
  routeTreeSha256: string;
  routingProxyInputSha256: string;
  rows: readonly StorefrontEdgeInventoryRow[];
  schemaVersion: 1;
}>;
