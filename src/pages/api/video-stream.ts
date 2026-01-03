import type { APIRoute } from 'astro';
import { fetchVideoUrl } from '../../services/aggregator';
import { encrypt, decrypt } from '../../utils/security';

export const GET: APIRoute = async ({ url, request }) => {
    // Basic Security Check
    const referer = request.headers.get('referer');
    const host = request.headers.get('host') || '';

    // Allow local dev and same-origin
    const isAllowed = !referer || referer.includes(host) || referer.includes('localhost') || referer.includes('127.0.0.1');

    if (!isAllowed) {
        return new Response(JSON.stringify({ error: 'Unauthorized Access' }), { status: 403 });
    }

    let source, bookId, episodeId;

    // Try to get encrypted payload first
    const q = url.searchParams.get('q');
    if (q) {
        const payload = decrypt(q);
        if (payload) {
            ({ source, bookId, episodeId } = payload);
        }
    }

    // Fallback to legacy params (can be removed later for strict security)
    if (!source) source = url.searchParams.get('source');
    if (!bookId) bookId = url.searchParams.get('bookId');
    if (!episodeId) episodeId = url.searchParams.get('episodeId');

    if (!source || !bookId || !episodeId) {
        return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
    }

    try {
        const videoUrl = await fetchVideoUrl(source, bookId, episodeId);

        // Encrypt the response so it's not visible in DevTools Network tab as JSON
        const encryptedResponse = encrypt({ videoUrl });

        return new Response(encryptedResponse, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain', // Hide that it's JSON
                'Cache-Control': 'public, max-age=600'
            }
        });
    } catch (error) {
        console.error("Video Stream Error:", error);
        return new Response(JSON.stringify({ error: 'Failed to fetch video URL' }), { status: 500 });
    }
};
