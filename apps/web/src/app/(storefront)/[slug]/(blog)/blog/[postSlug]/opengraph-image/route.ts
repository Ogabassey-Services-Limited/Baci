import Image from '../opengraph-image-renderer';

// Co-locate with the Supabase primary (eu-west-1 / Dublin) — route handlers
// and sibling layouts do not inherit the [slug] layout preferredRegion.
export const preferredRegion = 'dub1';

type RouteContext = {
  params: Promise<{ slug: string; postSlug: string }>;
};

export function GET(_request: Request, { params }: RouteContext) {
  return Image({ params });
}
