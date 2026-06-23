#!/usr/bin/env node
process.env.OGABASSEY_CWV_TARGET_LABELS ??= 'home,pdp-lcp';
process.env.OGABASSEY_CWV_SKIP_LATEST_BLOG_POST ??= '1';
await import('./measure-ogabassey-cwv.mjs');
