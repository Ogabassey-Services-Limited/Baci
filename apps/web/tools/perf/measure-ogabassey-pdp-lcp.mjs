#!/usr/bin/env node
process.env.OGABASSEY_CWV_TARGET_LABELS ??= 'pdp-lcp';
process.env.OGABASSEY_CWV_SKIP_LATEST_BLOG_POST ??= '1';
process.env.OGABASSEY_CWV_PSI ??= '0';
process.env.OGABASSEY_CWV_DEBUGBEAR ??= '1';
await import('./measure-ogabassey-cwv.mjs');
