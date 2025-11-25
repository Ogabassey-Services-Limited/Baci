import { MetadataRoute } from 'next'
import { headers } from 'next/headers'

type Props = {
    params: Promise<{ slug: string }>
}

export default async function robots({ params }: Props): Promise<MetadataRoute.Robots> {
    const { slug } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || `${slug}.localhost:3000`;
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const storeUrl = `${protocol}://${host}`;

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/checkout/', '/api/'],
        },
        sitemap: `${storeUrl}/sitemap.xml`,
    }
}
