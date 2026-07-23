# Durable Event Pipeline P0 Evidence Inventory

This document freezes the reviewed evidence boundary for the post-#3077 P0
recovery. It is an inventory and replay receipt, not a claim that the production
migration ledger reveals a total historical execution order.

## Frozen fixture receipts

| Fixture | Rows | SHA-256 |
| --- | ---: | --- |
| [#3077 path inventory](../../apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv) | 154 | `8a0f0b5e61d39fe46144e0114a41c7e25a8501e756ce1b819cca5fb793c6d0dc` |
| [#3077 regression paths](../../apps/web/tools/events/fixtures/event-pipeline-regression-paths.txt) | 64 | `cebd386858493293948812acd6e7861f236f0c3cfc5fa7484a27bbf32e6d5237` |
| [Open-PR migration lanes](../../apps/web/tools/events/fixtures/p0-open-pr-migration-lanes.tsv) | 17 | `c7c43af3103d291a40c745bc8742e8094d82dcce60bc7cf90f6a97eb8c342137` |

The path fixture is the byte-exact output of
`git diff --name-status 0e04f7cf^1 0e04f7cf`. The regression fixture is the
ordered extraction of test artifacts and
`supabase/tests/domain_event_pipeline.sql` from that path fixture. The
open-lane fixture contains only real migration rows; required-empty lanes are
documented below rather than represented by invented records.

## Frozen base and release split

- Immutable migration/replay base:
  `9e3d1b14b1931a5e441fc23f0e5417c188056e47`.
- Migration-base run `29417244012` completed successfully. Database job
  `87358367070` succeeded with `1 applied, 423 skipped`; its semantic-v1 log
  digest is
  `8d6bd79a6aefd1d6956141fba289018ec1902345bd85bce127a733ddb476215e`.
- The same run's application deploy job `87358421368` was
  `skipped_path_filtered`. It is not evidence of an application release for
  the immutable migration base.
- Current integration main after #3123 is
  `4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0`, a signed single-parent child of
  the immutable base. Its diff is limited to the iOS release workflow,
  `apps/mobile-storefront/**`, and the iOS ATT reliability plan, all outside
  the frozen P0 scope. The migration-tree and frozen-scope hashes are therefore
  unchanged.
- Exact-current-main run `29472376797` completed successfully. Database job
  `87537955743` succeeded with `0 applied, 424 skipped`; its semantic-v1 log
  digest is
  `57d230a7a72b001b5462dd993376c8e0c2f5a0943b3170a2110194d63d777c7c`.
  Deploy job `87537988080` was `skipped_path_filtered`. This no-op database
  receipt validates the unchanged migration tree but is neither a new
  production-effect provenance source nor proof of a web application release.
- The last proven web application release is
  `769c1645348d20f719e424423c9d3bedbc5985d0`, run `29380448299`.
  Database job `87244973582` succeeded, and deploy job `87245007215`
  succeeded at `2026-07-15T02:11:07Z`.

This database/application split is deliberate: the branch must merge exact
current integration main normally while keeping the immutable replay base, and
local inert P0 work may then proceed. H0 production-coherence claims remain
blocked until the completed P0 exact head later deploys successfully.

## Migration inventory and replay model

- Before P0, the repository has 424 top-level migration files, 422 unique
  versions, and tail
  `20260714225500_release_wallet_credit_push.sql`.
- The linked production inventory has 439 rows, tail `20260714225500`, and 17
  production-only rows mapped to repository owners below. The linked inventory
  is version-sorted membership evidence only.
- The frozen migration-tree digest is
  `757b9caab5d1d9ff22a3a2fbea35ce54448598031222b0d5fbe8a7eba9195983`.
- The schema-v4 production-effect provenance digest is
  `2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0`.
  It binds 24 primary evidence sources, 31 exceptional records, and coverage
  `partial-order-effect-replay`.

Replay begins with the current-tree registry in deterministic repository-path
chronology and applies only the receipt's evidence-backed exceptional splices
and explicit partial-order constraints before comparing database effects.
Neither the linked ledger nor this document claims a total historical order.
Partial-primary-log groups constrain only the records included in those groups.

## Immutable #3077 migration set

Run `29318477334`, database job `87037846150`, applied the following 26
migrations for merge `0e04f7cfec5767efb9dbfa5bc5a4e6ec4b738ce8`.

| Ordinal | Repository owner | SHA-256 |
| ---: | --- | --- |
| 1 | `supabase/migrations/20260712150001_domain_event_pipeline_tables.sql` | `4f31649ba4c9c3d6b5eb4110dbb0d144237502642d61c0606e15a9b1ba39556b` |
| 2 | `supabase/migrations/20260712150050_eventing_internal_schema.sql` | `3a3018fcd2e0daea0dec918d953e1dadf314ea1f88698e336a72a97da8ddcd1c` |
| 3 | `supabase/migrations/20260712150075_domain_event_idempotency_guard.sql` | `dcb23009b30f1970359737ccfc1e34f3b63b952a59e6854d1352a98b4fbdc21b` |
| 4 | `supabase/migrations/20260712150100_domain_event_enqueue_rpcs.sql` | `bce417899451c9bd0b5e18881b3776ecfcfb8128d2953d619c859e675c45cde1` |
| 5 | `supabase/migrations/20260712150101_analytics_domain_event_rpc.sql` | `10162654ecc524c5d0fafd8f6c08f2fa439a2cce791373a7dc5b05e4e94cffe7` |
| 6 | `supabase/migrations/20260712150102_domain_event_read_rpc.sql` | `a466608103ca395ac28582e30fcece53fb671b356e5422f9d58c6f5142a975e2` |
| 7 | `supabase/migrations/20260712150105_platform_domain_event_rpc.sql` | `09b1bbb4ae19c13465a94250764e12539e3b6aabfb18f7a4d2190afa79d6695a` |
| 8 | `supabase/migrations/20260712150106_ingress_replay_audit.sql` | `45f445c112e1e76e1ff66ac0def33b6f9957c8b70e29f25dc5753860b55d41c1` |
| 9 | `supabase/migrations/20260712150110_domain_event_routing_rpcs.sql` | `735db06e396e8fd235d8b410911c824b312e7fa6dd05edf74fef7eb166e7e85d` |
| 10 | `supabase/migrations/20260712150111_domain_event_metrics_rpc.sql` | `ae6d9af8d89034e2874c646a9d3ce76d84b93ea09e1aab16b84f7dab36f59819` |
| 11 | `supabase/migrations/20260712150115_event_delivery_replay_audit.sql` | `f443ec53e6c087db9cae6d80904a2042cfdbeaee36f94acfee341fc679ab9d82` |
| 12 | `supabase/migrations/20260712150120_event_delivery_rpcs.sql` | `7930f4e4d57cd264edf72a4e61ecea2309d60c629bc6267026721ab9535ac6b9` |
| 13 | `supabase/migrations/20260712150121_event_delivery_replay_rpc.sql` | `9efc932c818fe40f501a261399dbccf1e5146b0ec8e40050e0d4f0671e6c7f2c` |
| 14 | `supabase/migrations/20260712150122_event_delivery_batch_replay_rpc.sql` | `6809f521ff5a08934f44e9c76626d4b978e9630413421b08f39788292f15ed60` |
| 15 | `supabase/migrations/20260712150125_event_worker_heartbeats.sql` | `9c5865a13cc5c75f9b31183ea599fc8d51296d0c2c71cc9ae430120f69a1ab04` |
| 16 | `supabase/migrations/20260712150126_event_pipeline_admin_rpcs.sql` | `85897415c4352831b9e2cd48a3f2784e892c1e7316bdfccfa207482cef48e78e` |
| 17 | `supabase/migrations/20260712150130_domain_event_cdc_triggers.sql` | `43a75c9243d6232102e7462842e7a8f3d2459410434cad8630da787c170560a5` |
| 18 | `supabase/migrations/20260712150140_event_pipeline_retention_rpc.sql` | `11cb7190bd506ac7460170bcf2a18701eae227eb21292426d9b5e1c55741d031` |
| 19 | `supabase/migrations/20260713113000_preserve_delivery_context_in_domain_events.sql` | `6718cca7ae1f9dde88f0f6645be29b093025f6dbffeda1e4e006fca6108682a0` |
| 20 | `supabase/migrations/20260713120000_event_delivery_replay_and_idempotency_fixes.sql` | `60d7beb0f4cbb42de43046648dd44413a8dedf96559b7bd171f8a121eea69cf1` |
| 21 | `supabase/migrations/20260713205000_separate_delivery_replay_attempt_budget.sql` | `708770981937505e9d27e2196d99346d38ef745abf19abd253a350aec4a234aa` |
| 22 | `supabase/migrations/20260713222000_platform_event_legacy_idempotency.sql` | `427eb53af01548ae594013b71827324a544b3ffe37a41b302b74c1c386178457` |
| 23 | `supabase/migrations/20260714000100_harden_event_pipeline_admin_filters.sql` | `bfda81c357bff06435de481c993011652e173795d2497a5fde63e46c23102dca` |
| 24 | `supabase/migrations/20260714000200_scope_public_event_ingress.sql` | `619481d348cd55b38a5043f3ac003f39715887808328f96335ea4a2fa989e994` |
| 25 | `supabase/migrations/20260714000300_allow_tenant_verified_event_ingress_fallback.sql` | `c429a6a71fec0487645b47f312998a25f14ec2af4c2741ce3de6b7b36b9356cf` |
| 26 | `supabase/migrations/20260714000400_drop_legacy_event_ingress_rpc_overloads.sql` | `fbf3de3af3099d6624d3367bfd91d9bc49435487c78670e2efc202e2456a18d2` |

## Primary deployment/database evidence

The transport-stable semantic log hashes below bind the run/job observations
used by the production-effect provenance.

| Deployment run | Database job | Head SHA | Conclusion | Semantic log SHA-256 |
| ---: | ---: | --- | --- | --- |
| 27581785760 | 81543472691 | `0e6dc6ce4228ade3584fbc9a783513552617da50` | success | `af6ec638461ad02ac6972b9db5774a3e80b2ed0662239e899c8f83fdf128f1fc` |
| 28105650750 | 83219057619 | `c730dcb22ce020df739d87b5d01db8f204fc92a6` | success | `2193b5fd58b56ff957c8f14d7e2da6a884624c3a8a5d48eff37857db2530aeed` |
| 28397154002 | 84138758623 | `880b3d6aab332ed0c066f4dc8b83cc4b01cacb2a` | failure after applied entry | `4faea169929bbcb38f623952f920f607d1240a7eaea94ebf1eeb3931c3a9ebff` |
| 28561321799 | 84679401176 | `21e23cb7746ea8ec25b1cfb160050a3cfca5fc83` | success | `f429d6be1a1a64b896d514fee7e12cfa45e3ae8ef805303170e14df1dbbf63c6` |
| 28580496962 | 84739317565 | `b8ef31b2a2d9a8e7764da789d08932fe33653a54` | success | `e2394f7ff27d74b975dad78253a2985606cbb342f116cbaab407ff8a91ae1e97` |
| 28649277516 | 84963130874 | `49b7d3981a929a1f58c8532fdedb837b8d9de8b2` | success | `d397bde63b1730350945dc03262f79112583e88f3724b0da1123e5e515aebefb` |
| 28823016997 | 85479163687 | `496833440bffac952b2905a8096017d9f83d4aee` | success | `3cdf2979dedda2f73ced5739e2e22f70ea9edc39759e8e1fff6424bccb588209` |
| 28828076455 | 85495693863 | `aa24ea154735f9640fb57ae1d86dffa7e04cd0bb` | success | `57c6149714f7371297748d3d2a508c7cb72e3929b9790c5e0a8aa9a5a4789b7f` |
| 28873649727 | 85642773225 | `b9067a970dbf87afbc8ee108356876b9b0b7b4b7` | success | `bc3f6801e113674541bca94c1d617ddef0e51c982535eb0b36197191319e92ff` |
| 28955450451 | 85913066831 | `547a32b04901267052ec7774eeb1e1ae951ced9f` | success | `381f12fa6d0d8e7db94f75894f008fb1a6fd10b04ae53852ff1fba4caa53b006` |
| 28977145127 | 85987008267 | `2402fc7e969fda813c30004093d5fc06dfc5d3c4` | success | `90cc9a2b097a331d3d3cae4eb2cea4d8b456afd3d18ed0fb8469975515658404` |
| 29166042656 | 86579206872 | `92db375aff650cf8ac12fbf8a80e00dcd48e0fff` | failure after applied entry | `6bfb317c82d1a46e6990ece0b4b83e8652547bdfe6533ffb01c07835be7814e1` |
| 29250720772 | 86818299307 | `ec3027ef95c981335f0e986ae19b3ac808c24bde` | success | `daf2ae2dd91150158a3256117f4b6fd308cdffeec96dc6cb283a3daa0df2783d` |
| 29276021836 | 86905145251 | `b9101815c5f927679f46c262345a8dd7454d0d1e` | success | `e27b306223d0716c2df8e55907beef491ad0f35d43921e428b79ed383e387a74` |
| 29284101263 | 86932264596 | `8a0cabe7791e1701371c32a4ac911c32fb40322a` | success | `d183c0664d460d9b12a084cc5dfc0bd4a8834a80489c024e870e5b67b1c290d7` |
| 29286878808 | 86941439560 | `14de7528c240cac3aa8026268c3dcaebe791cd81` | success | `156d9dd403188b48f25a7a12d426e76ac93f0428f4bdb589f7d2e6d5a49c0437` |
| 29313663680 | 87023465691 | `adaafb81d98cd4ab12f10ea1ff67434510b5fb3a` | success | `1b4450b562c4cbfc0f65ffeba9451095c266a9766fb1050c41c932e3d2293150` |
| 29318477334 | 87037846150 | `0e04f7cfec5767efb9dbfa5bc5a4e6ec4b738ce8` | success | `622d12c395f23e976a8ffd8d4097a40437329f61592131af202e06a9e130bc22` |
| 29365841123 | 87197071269 | `19d03df8544270eaac9ee072f30f2294cd2024b6` | success | `a7c4f7b0b2ff225a9ec3dc9320bf83e0a051e5ba7366c465f3aeaa734064e0c4` |
| 29367954362 | 87207417765 | `1ba7562b640b418e47fd38a4a2449cfec82ea960` | success | `8f3169907d804eba0eb16c37d1fd4911ebbcb28b201e6f9615078ea31f2430ac` |
| 29370675467 | 87215018094 | `6758e4db3f28d3f2f7acc98e2802234f38631284` | success | `17f4715d4ed0265a1bb5ee5aa7a34946919889b5b9a403c01b08f9b0a4f7ae84` |
| 29378150948 | 87237670735 | `ca04b9f27ddaa67ff91a84bc72bb46508cca3fca` | success | `47c6d248b4b3bf353e9797959b5b5baca17dd023e90c4958799119ba75240584` |
| 29380448299 | 87244973582 | `769c1645348d20f719e424423c9d3bedbc5985d0` | success | `78984f89c5de2fa5b2ce1d29c90b5c929d00c820791f2fc50fff6ce8bfbbec94` |
| 29417244012 | 87358367070 | `9e3d1b14b1931a5e441fc23f0e5417c188056e47` | success | `8d6bd79a6aefd1d6956141fba289018ec1902345bd85bce127a733ddb476215e` |

The two failed-after-applied entries are admitted only with their separately
bound later-success/already-applied corroboration:

- run `28423874283`, database job `84230399303`, head
  `f83cff5af2ec76e66f1fd1c2815e85fefbc27db4`, semantic log SHA-256
  `c6e1806decafdb5d9007b8b73c4915dbb6f4ed1361c2df82f41c26b82d5fd129`;
- run `29181543481`, database job `86620056513`, head
  `caf391a981478eda3483de89037a91423d3a437d`, semantic log SHA-256
  `92646d5c7d19098b6c92cf57b4b6ddf29c931cb99a38fb45cfbc45da143a899f`.

Corroboration has no invented log ordinal and does not authorize other
ordering claims.

## Production-only mappings

These are the 17 linked rows mapped to reviewed repository owners. The final
row is the frozen, not-yet-materialized P0 append-only repair.

| Linked version/name (ordinal) | Repository owner | Owner SHA-256 | Rule |
| --- | --- | --- | --- |
| `20260623190041 enable_realtime_negotiation_requests` (207) | `supabase/migrations/20260623190000_enable_realtime_negotiation_requests.sql` | `bc2165173828d7a5c667e5a7415fb37b9ba7762aad2e12268b70eab6dcc94526` | canonical |
| `20260624211416 merchant_email_domains` (212) | `supabase/migrations/20260624200000_merchant_email_domains.sql` | `120e16cb8768fdec2e36ce041dc5049e299594d271e1f900a4abd0ac3c775ad6` | canonical |
| `20260626131520 fix_search_products_condition_filter` (218) | `supabase/migrations/20260702024830_fix_search_products_condition_filter.sql` | `d94d9d87b238c217a8640c9e5b2ef57263ff2112015fac7e2f40de2a91270ed3` | canonical |
| `20260630123511 fix_mobile_admin_product_phantom_columns` (248) | `supabase/migrations/20260702063638_restore_mobile_admin_product_rpc_contract.sql` | `a04858072ce04f37af2269bb14bd4a936df612b6243fdb0099e8b417ba9c3ba4` | superseded-final-state |
| `20260701080400 order_item_unit_costs_supplier_analytics` (249) | `supabase/migrations/20260702140100_order_item_unit_costs_supplier_analytics.sql` | `b2c0bd55fdb092549ccbc42ed4011def80cc2f5417451bba14df6476cdf4a8a9` | canonical |
| `20260701123945 supplier_purchase_analytics_branch_scope` (252) | `supabase/migrations/20260702140200_supplier_purchase_analytics_branch_scope.sql` | `722b166fda187ee2cf4d8200d1b99a4af88fd41055ab85ba5ece171bdd3a721c` | canonical |
| `20260706210329 allow_page_config_history_insert` (282) | `supabase/migrations/20260706162109_allow_page_config_history_insert.sql` | `3104462281e7e92658b25c36cbb21c95437da84babb6e18f95c45242adfa5594` | canonical |
| `20260706202930 add_storefront_preflight_rpcs` (280) | `supabase/migrations/20260706200000_add_storefront_preflight_rpcs.sql` | `091506e1cfb83822453a2134eb01f9e72fe78dbcb988eafe01412e78fd72d021` | canonical |
| `20260707064146 add_blog_listing_preflight_rpc` (286) | `supabase/migrations/20260706230000_add_blog_listing_preflight_rpc.sql` | `e6f1050fa096534a442b1b19aad68039c577bb620bb897e5ece172a1e5c73a04` | canonical |
| `20260708102643 optimize_storefront_cached_merchant_and_variant_wrappers` (312) | `supabase/migrations/20260707211507_optimize_storefront_cached_merchant_and_variant_wrappers.sql` | `2916e23dae09a40aa2e771798e3919ddea346f2ce8638837dd9a9de098b68e61` | canonical |
| `20260708072653 create_domain_purchase_transaction_rpc` (308) | `supabase/migrations/20260708013000_create_domain_purchase_transaction_rpc.sql` | `40b5b16c32136c3fa8300725a48469d43af8264f60c4b1faa4fdc6a99e3f00e6` | canonical |
| `20260708072825 fix_domain_purchase_rpc_merchant_derivation` (309) | `supabase/migrations/20260708013500_fix_domain_purchase_rpc_merchant_derivation.sql` | `53eca111142dda0f4f5030deeec5842b9eabc588f894d631a1830eb8f7dad999` | canonical |
| `20260708075932 lock_domain_purchase_rpc_service_role` (310) | `supabase/migrations/20260708090000_lock_domain_purchase_rpc_service_role.sql` | `7d522c998d5b32c230fe804cc21ffa0daa23832d37661a490164cbc840ba6855` | canonical |
| `20260708220832 drop_authenticated_domain_purchase_rpc` (315) | `supabase/migrations/20260708220947_drop_authenticated_domain_purchase_rpc.sql` | `005b89e87c87bcad7f5b206ad61cff05041458edd19f60409c73889ed7921bc9` | canonical |
| `20260713200830 split_platform_blog_anon_read_policy` (411) | `supabase/migrations/20260713211500_split_platform_blog_anon_read_policy.sql` | `d51de0171bb6837e4ed9fa161b1785de2d77915446d89cb2a857a0f403fa337f` | canonical |
| `20260625173604 public_read_storefront_feature_settings` (216) | `supabase/migrations/20260714010000_scope_feature_settings_read_policies.sql` | `31091717a01f66c683c87e77a2f62245732df023b6dd61055855cf7ff78cff9f` | superseded-final-state |
| `20260629154903 add_order_fulfillment_timestamps` (247) | `supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql` | `1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361` | append-only-repair |

## Duplicate-version ownership

- Version `20260615120000` is production-owned by
  `20260615120000_register_push_token_rpc.sql`
  (`6000b0006539041c1bd914567ebcbc31eb15e8f14401ae488d0a609ce74b4293`).
  The synthetic `20260615120000_customer_order_cancellation.sql` companion
  (`acb7406d4975c5cd8d3964e86b991b51046b6f750d49b3769699b878b92192d3`)
  replays immediately after that owner.
- Version `20260713130000` is production-owned by
  `20260713130000_add_storefront_paystack_subaccount_configured_rpc.sql`
  (`9cb95f8ba9ebd75568b9b5c7ee17521981465fa330d18a76ed467a179dd79645`).
  The colliding `20260713130000_quiz_finalize_rank_winners.sql`
  (`3140c3a76b2cd6ca1952dc166cd5e010d15c7070fde0647e41ad9bfc7d400ab2`)
  is omitted in favor of its unique-version reapply.

These are explicit replay relations, not additional production-effect evidence
records.

## Merged late-history evidence

- #3117 merged at
  `ca04b9f27ddaa67ff91a84bc72bb46508cca3fca`. Run `29378150948`,
  database job `87237670735`, applied
  `20260714102200_quiz_identity_and_device_caps.sql`; owner SHA-256 is
  `60e010cb814242dd13e31791e5bf26cc8f93461636ac75587456f9b266282979`.
- #3121 is the last proven application release
  `769c1645348d20f719e424423c9d3bedbc5985d0`. Run `29380448299`,
  database job `87244973582`, applied
  `20260714225500_release_wallet_credit_push.sql`; owner SHA-256 is
  `98b81fbe048dd4e65c40f4b217e2b892c5538fe3a3d6c15714b2d6215265db52`.
  Deploy job `87245007215` succeeded.
- #3120's exact production-history owner is
  `20260714220000_quiz_event_lifecycle_followup.sql`, owner SHA-256
  `30d2f298b74c7fe406440b1c0feffd849b4d4e40d928de0f497ba63716608a44`.
  It is exceptional record 30 and was applied by exact-base run
  `29417244012`, database job `87358367070`.

These merged lanes are production-history evidence, not open-PR lane rows.

## Open migration lanes

- #3024 was frozen at
  `f160108c09ebd2d2367b3ae612a7aa9349febd97`. It has exactly the 17
  collision-free path/body pairs below and is outside P0 code scope.
- #2958 was observed at
  `3666b70b6ec7ead109910cdf5816392eca0d0b9e`; its required top-level
  migration set is empty.
- #2686 and #2928 also have required-empty top-level migration sets.

| PR | Migration owner | Blob SHA-256 |
| ---: | --- | --- |
| 3024 | `supabase/migrations/20260708093415_merchant_payment_credentials.sql` | `2d702e2a39a90b4b78f0015a474c1cd62bbb699af92957924a34c8778b0c44a1` |
| 3024 | `supabase/migrations/20260708140644_byok_direct_settlements.sql` | `9b0455094b31d0e81a7dfd8a9c83201512ae870410ade6aaec23e9bff9fcf072` |
| 3024 | `supabase/migrations/20260708150000_paypal_capture_persist_reconciliation_issue.sql` | `efb14411b91c0118dc13b0d50d9dbd54e8d743c7c900280aa1470ad7611c41b0` |
| 3024 | `supabase/migrations/20260712090000_delete_merchant_payment_credential_role.sql` | `0308b957a622c68bfa02f79dacda3243b61b678b91fdb20f4d3accb4994d3a73` |
| 3024 | `supabase/migrations/20260712100001_orders_paid_transaction_marker.sql` | `0b4f1455a50879471e899afeecdaefb0b03e1e1a7b5657c571cd400d7e8a6c5d` |
| 3024 | `supabase/migrations/20260712100002_orders_paid_transaction_marker_index.sql` | `6b2f4f4139702abcd5be077a069769114d47b7f0302a7c4d69d8b6441007df51` |
| 3024 | `supabase/migrations/20260712100100_credit_customer_wallet_order_refund.sql` | `d34e31e49b9d5a7ea3a2631d7a29d45a06e5cc0db76ce80019ea2a02dad4519e` |
| 3024 | `supabase/migrations/20260713140001_touch_merchant_credential_validated_by_environment.sql` | `59247745bfa511c70e4c4d0bfdb26abc8652c5565ef9e994c1a29247deee8f1b` |
| 3024 | `supabase/migrations/20260713150001_public_snapshot_paypal_flags.sql` | `f2fe9d9345c4728a1a34f8cd44e6f1456fae2f18d88da6f7449cefce8d0a1de8` |
| 3024 | `supabase/migrations/20260714090001_transactions_refund_statuses.sql` | `951c980acd5d98a49d10160e0d830b50bfe9c9c7ed33585dce2327bdd4b8d986` |
| 3024 | `supabase/migrations/20260714090002_transactions_refund_pending_index.sql` | `f74bd1af1d8237976468e4df510b577e8b4de0947ba117fe9abb36cac6811e51` |
| 3024 | `supabase/migrations/20260714130000_include_paypal_capture_persist_review_type.sql` | `072dd7791e4b9414187fe63c9056543f1b83b1a83837681584a9ae9527e020f3` |
| 3024 | `supabase/migrations/20260714162000_replace_merchant_payment_credential_pair.sql` | `33d873748cd948a92c4cb32d2f12d3dba06670810fd4dc9b735fc54dac8ea0cc` |
| 3024 | `supabase/migrations/20260714162100_mark_savings_redemptions_reversed.sql` | `fd3391ef880d88b3b2f7083888a43099476489b52f6311dd004151efbebfe66d` |
| 3024 | `supabase/migrations/20260714162200_drop_legacy_credential_validation_touch.sql` | `cd91c66fed1a158455c83928e4eae42d3f3dd8a1db826c235e68857e689049fb` |
| 3024 | `supabase/migrations/20260714162300_mark_paypal_transaction_refunded.sql` | `6078df1576ec4ea3c94d565a6180242a688186c5e8e25ef943bb23144e6fa3c7` |
| 3024 | `supabase/migrations/20260714162400_order_payment_snapshot_merchant_country.sql` | `6bb7429b5f50c4116febc9c5c41cd1244105b9d0852944954825c6139ea64718` |

A lane merge, frozen path/blob change, or collision with
`20260714225501_reconcile_order_fulfillment_timestamps.sql` invalidates this
receipt. Unrelated head advancement is observational.

## Separate migration-name repair

The canonical migration-name-alias repair receipt has SHA-256
`ba97d2e25bb8d2f43e0a4fdfdb1fa37586fd9c7397458fa8dc0c0c5858288ade`.
It permits only version `20260604132853` to reconcile the linked name
`fix_storefront_order_customer_returning_id_ambiguity` with repository name
`fix_create_storefront_order_customer_returning_id_ambiguity`. The repair
records failed run `29384198864` / database job `87253957845` and successful
run `29417244012` / database job `87358367070`, proves no ledger write, and
is not a production-effect exceptional record.

## Scope exclusions and deferred debt

#3060's proposed second queue and HTTP drainer are superseded and are not
imported into P0. P0 prepares and proves the existing #3077 worker boundary but
does not enable producers, install workers, or activate delivery.

The P0 modularity gate explicitly defers `apps/web/src/lib/tiktok-events-api.test.ts`
and unrelated pre-existing oversized files that #3077 merely touched:

- `apps/web/src/app/(platform)/onboarding/actions.ts`
- `apps/web/src/app/(platform)/onboarding/actions.test.ts`
- `apps/web/src/app/api/orders/route.ts`
- `apps/web/src/app/checkout/page.tsx`
- `apps/web/src/app/api/payments/juicyway/webhook/route.ts`
- `apps/web/src/components/storefront/ogabassey/pages/imei-checker.test.tsx`
- `apps/web/src/env.ts`
- `apps/web/src/env.test.ts`

Those storefront/onboarding, checkout, orders, payment-webhook, IMEI, and
environment modules are recorded debt, not authority to broaden this recovery.

## Task 9 final P0 exact-head handoff receipt — 2026-07-20

### Claim boundary

This section is the active, append-only Task 9 handoff. Earlier schema-v4 and
historical graph statements above remain provenance; where values differ, the
schema-v5 and exact-head values below are current. P0 establishes migration,
authority, worker, and deployment safety. It does not itself change a storefront
response or claim a Core Web Vitals improvement.
It does not activate producers or workers, assert a total order across
exceptional history, or convert disposable historical replay convergence into
a claim that the current production database itself was replay-converged.

### Derived exact graph

- Reviewed source head: `14d24cb7590711ec608de5c7d83a45192c8492b6`.
- Fetched `origin/main`, merge base, and upstream base:
  `ac2564ff1ba76ecc179fda9ebedeb91d5b571936`.
- Ahead/behind: `2/0`; branch-only merge commits: `0`.
- Exact branch commits:
  `14fba75baf69904f6a7b411191f912a13e219fa2` (`feat: attest
  post-replay production state`) and
  `14d24cb7590711ec608de5c7d83a45192c8492b6` (`fix: freeze post-replay
  attestation receipt`).
- Recovery merge `bb55d407e01b719a9014c87fb8a8253861b7005d` is an ancestor of the
  reviewed head.

### Schema-v5 immutable bindings

- Replay base: `9e3d1b14b1931a5e441fc23f0e5417c188056e47`.
- Normative V4 receipt SHA-256:
  `3503ca9613b6a511b2e37fb3d35b48830d19e8559e7e3c5df136487fce9efdca`.
- Schema version: `5`; provenance SHA-256:
  `1f1e4e3112a0010dbed91a25a8185d38fcfd4cf56d2d2b60ca76306bbbb100e1`.
- Provenance inventory: 25 sources, 31 exceptional records, 9 replay
  relations, and 2 forward repairs.
- Registry inventory: 427 chronological entries and 425 production-effect
  entries. Physical inventory: 439 chronological entries and 437
  production-effect entries.
- Frozen ledger: 442 entries, ending at version `20260714225503`. Live ledger:
  454 entries, ending at version `20260718070011`.
- Frozen/live effect SHA-256:
  `71cba5629959c75352726e26cafcbfec8de99b1b52d10e6ad70fd85f07e4d253`
  and `dd1f3d2e2b84fd1fe866eb3bd1baa44fc5edcf67aa97a53d1984e5d0b312bc70`.
- Surface inventory: 76 components and 19 RPCs. The only frozen/live
  structural difference is the recorded singleton constraint delta.
- Migration-name-alias repair SHA-256:
  `ba97d2e25bb8d2f43e0a4fdfdb1fa37586fd9c7397458fa8dc0c0c5858288ade`.
- Forward-repair receipt SHA-256:
  `8258b2098f1086a60e166935edf5313f2601977979d4eb1cb31c8ca41ef94e8c`.
- Frozen fixture SHA-256 values: ledger
  `0d8b54ecdae67d99da4e806276310e80992bda73ee94efaaf7a91fd16c3d8885`,
  production effects
  `bc1e37a53410d8dbeead2f3929a6e47149589ba68806fca88a359e0b9c7411c1`,
  semantic lines
  `1d550b33b8f681cdd2f1751279e6d93c1110457834d8743969aa6047d7e33eca`,
  and old cancellation
  `58b56f449017041b5311b727e9fe4f217e2880c1a31d5f1da4c1607ff6edd298`.

### Disposable exact-head replay receipts

Both replay modes ran sequentially from a disposable exact-head checkout. All
owned containers and the checkout directory were removed, and neither protected
active-worktree marker changed.

| Mode | Ordered sources | Fresh receipt SHA-256 | Result |
| --- | ---: | --- | --- |
| Chronological | 427 | `aca3ae54cb230f217642911c5813786bc3e8ea9629bf9eadc5f4f01fff774e1e` | PostgreSQL `170006`; enforcement on; converged; no changed components |
| Production effect | 426 | `d7c5314fb1cb6bdecb965b351e62d3e16207bed4b5500795a0d764ec3bdb2fea` | PostgreSQL `170006`; enforcement on; converged; no changed components |

Each mode reproduced effect SHA-256
`71cba5629959c75352726e26cafcbfec8de99b1b52d10e6ad70fd85f07e4d253`,
proved that versions `20260718070000` through `20260718070011` are absent from
the historical ordered sources, and reproduced the cancellation transition
from `6155b28720d0f4a8a20746aa1a2365e631249e940fa7339e0e19b66c28fa1e62`
to `b21dc2134c1aa3df7aed6c8b7a57173b1fed910a04730f901e56622862503556`.
One disposable GoTrue startup timed out before SQL execution; owned resources
were removed and a fresh isolated retry passed.

All six required SQL checks passed in both modes:

| Check | SHA-256 |
| --- | --- |
| Reconciliation timestamps | `822cc82a03b75cc76bf940cd76a11884cfe96fa7670c3be1cc9f731fb4225b0f` |
| Duplicate semantics | `5c4cbda686fa423db01fc4bcebf02ae373798c4c90102c0435a5936172b7a833` |
| Duplicate JSONB | `32ce9ce2c71855172606157ff836008d9eaa0b2a5fbbf16658f301184400083c` |
| Cancellation reason | `f76f0bf901bb20929f516543d093729706abf5948de38eb2e6f123f609810cf5` |
| Merchant anonymous exposure | `52dd02107f30d5048d507bd6e8c04be062cb83386e9f7224f24e01d6aa760b5a` |
| Domain event pipeline | `6f602f5e9e6d0595d18cb6ee781c64d522f60473ca119f40a276c6658c9d0988` |

The domain-event driver also verified ingress child SHA-256
`07abd3396e36a5b4feb9c22f43d106bc6dbcb2c5a8a0e21d273f29a98b8ff96c`
and delivery child SHA-256
`e91e3610be20d968b38db558213e84feacdfd5c70982edd2dbb1cf633162284f`.

### Production post-replay attestation

- Deployment merge: `fb6c7570ac1a0897efb9890db6b9992410c5eb7a`.
- Workflow run `29676236659`; database job `88164086530`.
- Semantic log SHA-256:
  `9c91aeab90841c40970f18a4d37a988f85a9204a6fde36daa4a07bdea5438ffa`.
- Summary: 12 applied and 427 skipped.
- Frozen-prefix SHA-256:
  `1ddb8497e4d0cc692a4f8fd5c5dec7f5da16d49b4c45c0511d4f19e7646b8ffc`.
- Live-ledger SHA-256:
  `ce47c285538cd31047888b4b68c3e4291ace8774e3c29a1bed9735508e5c8832`.
- Live-effect SHA-256:
  `dd1f3d2e2b84fd1fe866eb3bd1baa44fc5edcf67aa97a53d1984e5d0b312bc70`.
- Query/scope SHA-256:
  `2b555af09c8a9cb7e8026b028c014b304de146a9f50a2c2f2a896a6626dfacbc`
  and `a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245`.
- Singleton constraint
  `public.reconciliation_review.reconciliation_review_issue_type_check`
  moved from frozen SHA-256
  `e8c7feafd3d4249f19bdabadb9d38075dc303ec4b0c5e0dad579698500fb7906`
  to live SHA-256
  `b8162359116ec9a8565e08b8050a9646f711d081878f21c56a05f9963ff0c229`.

The no-write live verifier passed against the recursively frozen, 12-entry
attestation receipt. The receipt rejects an invalid manifest source during
module loading.

### Cumulative quality and authority gates

- Frozen application regressions: 57 web files/431 tests, 8 successor
  files/36 tests, 1 shared file/7 tests, and 5 VPS files/22 tests.
- Database tools: 86 files/552 tests.
- Full monorepo tests: all 5 tasks passed; web reported 3,008 passed and 1
  skipped files with 23,884 passed and 1 todo tests.
- Normal web and tools-worker typechecks passed. Monorepo lint/typecheck passed
  with only the recorded unrelated warnings.
- Live modularity, analytics-authority, and 154-seed boundary verifiers passed.
- Production-effect `--verify-only` passed. A transient GitHub HTTP 503 while
  reading historical job logs recovered; exact jobs `81543472691` and
  `84230399303` subsequently returned successfully before the final verifier.
- VPS proof remains inert: both event worker units report `LoadState=not-found`,
  `ActiveState=inactive`, `SubState=dead`, and an empty `FragmentPath`.

### Review receipts

- Independent Task 8.5 review returned READY/CLEAN at
  `14fba75baf69904f6a7b411191f912a13e219fa2`.
- Local CodeRabbit produced two substantive major findings on the receipt
  change: runtime immutability and missing invalid-manifest module-load
  coverage. Both were reproduced, fixed, and passed focused and cumulative
  verification. A later clean-verdict retry was externally rate-limited before
  analysis and is not represented as a clean review.
- Fresh independent exact-head review returned READY/CLEAN for full range
  `ac2564ff1ba76ecc179fda9ebedeb91d5b571936..14d24cb7590711ec608de5c7d83a45192c8492b6`.
- Independent evidence-only document review returned READY/CLEAN; it validated
  the exact graph, schema-v5 bindings, replay and attestation receipts,
  protected state, inert worker proof, deployment blocker, and bounded claims.
- The required evidence-only local CodeRabbit attempts exited during setup with
  `No files to review`; the CLI performed no analysis of the Markdown-only
  change, so no clean CodeRabbit verdict is claimed for this document.

### Protected state and deployment-coherence handoff

Protected marker SHA-256 values remained
`c38e4136dae3e1849907643734ed2f1ea4c3c1829b41e81b55092246810d2d32`
for `apps/web/supabase/.temp/cli-latest` and
`0daaac4eb443724f347b3d1df0dbacffb1e0755f345412d1f9032eb664aa9b18`
for `supabase/.temp/cli-latest`. The latter path's tracked working-tree drift
predated Task 9 and was never staged, reset, or modified by this work.

Automatic deployment run `29702227893` for exact SHA
`ac2564ff1ba76ecc179fda9ebedeb91d5b571936` completed its prebuilt Vercel
build and deploy but failed job `88233101830` only at `Purge and verify
storefront release HTML`: the Cloudflare credential returned HTTP 401 / code
10000. This is the remaining production-coherence blocker. Repair the
Cloudflare credential and let the normal deployment/coherence path rerun; do
not deploy manually.

After coherence is restored, proceed with the H0 runner and measurement before
selecting H1 or H2 from evidence. Nothing in this P0 receipt is a claim that
LCP, FCP, CLS, INP, or TTFB has improved.
