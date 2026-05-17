import Image from '../opengraph-image-renderer';

type RouteContext = {
  params: Promise<{ slug: string; postSlug: string }>;
};

export function GET(_request: Request, { params }: RouteContext) {
  return Image({ params });
}
