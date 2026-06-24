#!/usr/bin/env node
function setDefaultEnv(key, value) {
  if (`${process.env[key] ?? ''}`.trim()) return;
  process.env[key] = value;
}

process.env.OGABASSEY_CWV_TARGET_LABELS = 'pdp-lcp';
setDefaultEnv(
  'OGABASSEY_PDP_LCP_URL',
  'https://ogabassey.com/laptops/lenovo-legion-pro-9-16irx9-rtx-4090'
);
process.env.OGABASSEY_CWV_USE_PDP_LCP_URL = '1';
process.env.OGABASSEY_CWV_RESOLVE_PDP_CANONICAL = '1';
process.env.OGABASSEY_CWV_SKIP_LATEST_BLOG_POST = '1';
process.env.OGABASSEY_CWV_PSI = '0';
process.env.OGABASSEY_CWV_DEBUGBEAR = '1';
process.env.OGABASSEY_CWV_SUMMARY_TABLE = '0';
process.env.OGABASSEY_CWV_LEGACY_PDP_LCP_JSON = '1';
if (!`${process.env.OGABASSEY_AUDIT_OUTPUT_DIR ?? ''}`.trim()) {
  process.env.OGABASSEY_AUDIT_OUTPUT_DIR =
    process.env.DEBUGBEAR_RAW_DIR?.trim() || '/tmp';
}
await import('./measure-ogabassey-cwv.mjs');
