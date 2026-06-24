#!/usr/bin/env node
function setDefaultEnv(key, value) {
  if (`${process.env[key] ?? ''}`.trim()) return;
  process.env[key] = value;
}

setDefaultEnv('OGABASSEY_CWV_TARGET_LABELS', 'home,pdp-lcp');
setDefaultEnv('OGABASSEY_CWV_SKIP_LATEST_BLOG_POST', '1');
setDefaultEnv('OGABASSEY_CWV_STRATEGIES', 'mobile');
setDefaultEnv('OGABASSEY_CWV_USE_PDP_LCP_URL', '0');
await import('./measure-ogabassey-cwv.mjs');
