import type { APIRoute } from 'astro';
import { fetchVideoUrl } from '../../services/aggregator';
import { decrypt } from '../../utils/security.server';

export const GET: APIRoute = async ({ url, request }) => {
    // Basic Security Check
    // Basic Security Check
    const referer = request.headers.get('referer');
    // Check X-Forwarded-Host first (standard for reverse proxies like Nginx/aaPanel), then Host
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';

    // Allow local dev, same-origin, and known deployment domains
    const isAllowed = !referer ||
        referer.includes(host) ||
        referer.includes('localhost') ||
        referer.includes('127.0.0.1') ||
        referer.includes('qzz.io'); // Explicitly allow deployment domain suffix

    if (!isAllowed) {
        return new Response(JSON.stringify({ error: 'Unauthorized Access' }), { status: 403 });
    }

    let source, bookId, episodeId;

    // Require encrypted payload 'q'
    const q = url.searchParams.get('q');
    if (q) {
        const payload = decrypt(q);
        if (payload) {
            ({ source, bookId, episodeId } = payload);
        }
    }

    if (!source || !bookId || !episodeId) {
        return new Response(JSON.stringify({ error: 'Missing parameters or invalid encryption' }), { status: 400 });
    }

    try {
        const videoUrl = await fetchVideoUrl(source, bookId, episodeId);

        // Return JSON directly - the real video URL is hidden because it goes through /api/proxy
        // Token-based providers should have short or no cache to avoid expiry issues
        const sensitiveProviders = ['shortmax', 'hishort', 'starshort', 'freeshort', 'dramawave'];
        const ttl = sensitiveProviders.includes(source) ? 60 : 3600; // 1 min for sensitive, 1 hour for others

        return new Response(JSON.stringify({ videoUrl }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
                'Cloudflare-CDN-Cache-Control': `max-age=${ttl}`
            }
        });
    } catch (error) {
        console.error("Video Stream Error:", error);
        return new Response(JSON.stringify({ error: 'Failed to fetch video URL' }), { status: 500 });
    }
};
