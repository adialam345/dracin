import type { APIRoute } from 'astro';
import { fetchAggregatedSearch } from '../../services/aggregator';

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const size = parseInt(url.searchParams.get('size') || '12');

    try {
        if (!query) {
            return new Response(JSON.stringify({ results: [], hasMore: false }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Use the centralized aggregator which includes ALL providers (Dramabox, Netshort, Melolo, ReelLife, etc.)
        const allItems = await fetchAggregatedSearch(query);

        // Calculate pagination (since aggregator fetches all, we paginate in memory)
        // Note: For a "Show More" functionality, this is slightly inefficient if we re-fetch everything every page,
        // but given the aggregator caches results internally, it should be fast.
        // Ideally, the aggregator could support pagination, but cross-provider pagination is complex.

        const startIndex = (page - 1) * size;
        const endIndex = startIndex + size;

        const paginatedResults = allItems.slice(startIndex, endIndex);
        const hasMore = endIndex < allItems.length;

        return new Response(JSON.stringify({
            results: paginatedResults,
            page,
            size,
            total: allItems.length,
            hasMore
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            }
        });

    } catch (error) {
        console.error('Search API error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to fetch search results',
            results: [],
            hasMore: false
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};
