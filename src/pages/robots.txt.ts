import type { APIRoute } from 'astro';

const robotsTxt = `
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: https://nontonin.site/sitemap.xml
`.trim();

export const GET: APIRoute = async () => {
    return new Response(robotsTxt, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            // Cache control bisa membantu mencegah CDN memodifikasi
            'Cache-Control': 'public, max-age=3600'
        }
    });
};
