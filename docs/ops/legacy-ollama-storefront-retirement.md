# Legacy Ollama Storefront Retirement

The VPS Ollama/Gemma full-layout worker remains for historical and explicitly
created `storefront_layout_generation` jobs. New onboarding creates only the
deterministic curated homepage and never enqueues or triggers this worker.
Retirement requires a separately approved queue and usage audit; preserve the
signed trigger, fallback sweep, locks, job API, and historical processing until
that gate passes.
