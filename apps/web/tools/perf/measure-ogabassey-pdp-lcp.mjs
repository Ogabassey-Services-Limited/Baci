#!/usr/bin/env node
process.env.OGABASSEY_CWV_TARGET_LABELS ??= 'pdp-lcp';
process.env.OGABASSEY_PDP_LCP_URL ??=
  'https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090';
process.env.OGABASSEY_CWV_RESOLVE_PDP_CANONICAL ??= '0';
if (!process.env.OGABASSEY_AUDIT_OUTPUT_DIR && process.env.DEBUGBEAR_RAW_DIR) {
  process.env.OGABASSEY_AUDIT_OUTPUT_DIR = process.env.DEBUGBEAR_RAW_DIR;
}
process.env.OGABASSEY_CWV_SKIP_LATEST_BLOG_POST ??= '1';
process.env.OGABASSEY_CWV_PSI ??= '0';
process.env.OGABASSEY_CWV_DEBUGBEAR ??= '1';
await import('./measure-ogabassey-cwv.mjs');
