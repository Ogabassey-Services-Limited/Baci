import { readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  buildCrawlDepthCoverageReport,
  collectModuleHrefs,
  formatCrawlDepthCoverageReport,
} from './verify-ogabassey-crawl-depth-coverage';
import { parseSemrushCsvPageUrls } from './verify-ogabassey-crawl-depth-csv';

export {
  buildCrawlDepthCoverageReport,
  collectModuleHrefs,
  formatCrawlDepthCoverageReport,
} from './verify-ogabassey-crawl-depth-coverage';
export { parseSemrushCsvPageUrls } from './verify-ogabassey-crawl-depth-csv';

function loadModuleHrefs(jsonPath?: string) {
  if (!jsonPath) {
    return new Set<string>();
  }

  return collectModuleHrefs(JSON.parse(readFileSync(jsonPath, 'utf8')));
}

export function runOgabasseyCrawlDepthModuleVerifierCli(
  args = process.argv.slice(2),
  logger: (message: string) => void = console.log
) {
  const [csvPath, moduleHrefJsonPath] = args;

  if (!csvPath) {
    throw new Error(
      'Usage: verify-ogabassey-crawl-depth-modules <semrush.csv> [module-hrefs.json]'
    );
  }

  const urls = parseSemrushCsvPageUrls(readFileSync(csvPath, 'utf8'));
  const moduleHrefs = loadModuleHrefs(moduleHrefJsonPath);
  const report = buildCrawlDepthCoverageReport(urls, moduleHrefs);
  logger(formatCrawlDepthCoverageReport(report));

  return report.missingMaintainedRows > 0 ? 1 : 0;
}

const currentFile = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (import.meta.url === currentFile) {
  try {
    process.exit(runOgabasseyCrawlDepthModuleVerifierCli());
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
