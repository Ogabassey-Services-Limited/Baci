import robots from '@/app/robots';

const ROBOTS_CACHE_CONTROL = 'public, max-age=300, s-maxage=300';

type RobotsRule = {
  allow?: string | readonly string[];
  crawlDelay?: number;
  disallow?: string | readonly string[];
  userAgent?: string | readonly string[];
};

type RobotsConfig = {
  host?: string;
  rules?: RobotsRule | readonly RobotsRule[];
  sitemap?: string | readonly string[];
};

function isStringList(
  value: string | readonly string[]
): value is readonly string[] {
  return Array.isArray(value);
}

function isRuleList(
  value: RobotsRule | readonly RobotsRule[]
): value is readonly RobotsRule[] {
  return Array.isArray(value);
}

function stringValues(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  return isStringList(value) ? [...value] : [value];
}

function ruleValues(
  value: RobotsRule | readonly RobotsRule[] | undefined
): RobotsRule[] {
  if (value === undefined) return [];
  if (isRuleList(value)) return [...value];
  return [value];
}

function appendRuleLines(lines: string[], rule: RobotsRule): void {
  const userAgents = stringValues(rule.userAgent);
  for (const userAgent of userAgents.length > 0 ? userAgents : ['*']) {
    lines.push(`User-Agent: ${userAgent}`);
  }

  for (const allowPath of stringValues(rule.allow)) {
    lines.push(`Allow: ${allowPath}`);
  }

  for (const disallowPath of stringValues(rule.disallow)) {
    lines.push(`Disallow: ${disallowPath}`);
  }
}

function serializeRobots(config: RobotsConfig): string {
  const lines: string[] = [];
  const rules = ruleValues(config.rules);

  for (const rule of rules) {
    appendRuleLines(lines, rule);
    lines.push('');
  }

  for (const sitemap of stringValues(config.sitemap)) {
    lines.push(`Sitemap: ${sitemap}`);
  }

  return `${lines.join('\n').trim()}\n`;
}

function fallbackRobots(): string {
  return ['User-Agent: *', 'Disallow:', ''].join('\n');
}

function robotsResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': ROBOTS_CACHE_CONTROL,
    },
  });
}

export async function GET(): Promise<Response> {
  try {
    const config = await robots();
    if (!config || typeof config !== 'object') {
      return robotsResponse(fallbackRobots());
    }

    return robotsResponse(serializeRobots(config));
  } catch (error) {
    console.error('Failed to generate robots.txt:', error);
    return robotsResponse(fallbackRobots());
  }
}
