-- Task 1 replay overlay: apply only the pending category dependency closure.
\ir ../migrations/20260726103000_atomic_category_hierarchy_lifecycle.sql
\ir ../migrations/20260726201000_harden_category_hierarchy_lifecycle.sql
\ir ../migrations/20260727143000_storefront_cache_transition.sql
\ir ../migrations/20260727143100_storefront_cache_transition_delivery.sql
\ir storefront_cache_transition.sql
\ir event_pipeline_local_catalog.sql
