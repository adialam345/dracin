import type { APIRoute } from 'astro';
import { fetchVideoUrl } from '../../services/aggregator';

export const GET: APIRoute = async ({ url }) => {
    const source = url.searchParams.get('source');
    const bookId = url.searchParams.get('bookId');
    const episodeId = url.searchParams.get('episodeId');

    if (!source || !bookId || !episodeId) {
        return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
    }

    try {
        const videoUrl = await fetchVideoUrl(source, bookId, episodeId);
        return new Response(JSON.stringify({ videoUrl }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=600' // Cache for 10 minutes
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch video URL' }), { status: 500 });
    }
};
