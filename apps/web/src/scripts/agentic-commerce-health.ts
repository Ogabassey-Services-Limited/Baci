import 'dotenv/config';

import { pathToFileURL } from 'node:url';
import { runAgenticCommerceHealthMonitor } from '@/app/api/cron/agentic-commerce-health/route';

export async function runAgenticCommerceHealthCli(): Promise<number> {
  const summary = await runAgenticCommerceHealthMonitor({
    includeSupportChat:
      process.env.AGENTIC_HEALTH_INCLUDE_SUPPORT_CHAT === 'true',
  });

  console.log(JSON.stringify(summary, null, 2));

  return summary.status === 'attention' ? 1 : 0;
}

const currentFile = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (import.meta.url === currentFile) {
  runAgenticCommerceHealthCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}
