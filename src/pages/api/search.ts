// API endpoint for paginated search results with progressive loading
import type { APIRoute } from 'astro';

const API_BASE = 'https://api.sansekai.my.id/api';

import { fetchCached } from '../../services/utils';

// Delegate to central fetch utility which handles headers and proxies
async function fetchWithRetry(url: string, retries: number = 2): Promise<any> {
    return fetchCached(url, retries);
}

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const size = parseInt(url.searchParams.get('size') || '12');

    try {
        // Calculate which sources to fetch based on page number
        // We'll fetch from all sources and combine results
        const promises = [];

        // DramaBox - supports pagination
        promises.push(
            fetchWithRetry(`${API_BASE}/dramabox/search?query=${encodeURIComponent(query)}&page=${page}&size=${size}`)
                .then(data => {
                    if (!data) return { source: 'dramabox', items: [], hasMore: false };
                    return {
                        source: 'dramabox',
                        items: (Array.isArray(data) ? data : data.bookList || data.data?.bookList || []).map((item: any) => ({
                            id: item.bookId || item.id,
                            title: item.bookName || item.title,
                            cover: item.coverWap || item.cover,
                            description: item.introduction || item.desc,
                            source: 'dramabox'
                        })),
                        hasMore: data.hasMore || data.data?.hasMore || false
                    };
                })
        );

        // NetShort - fetch all and paginate client-side
        if (page === 1) { // Only fetch on first page
            promises.push(
                fetchWithRetry(`${API_BASE}/netshort/search?query=${encodeURIComponent(query)}`)
                    .then(data => {
                        if (!data) return { source: 'netshort', items: [], hasMore: false };
                        return {
                            source: 'netshort',
                            items: (data.searchCodeSearchResult || data.data?.list || []).map((item: any) => ({
                                id: item.shortPlayId || item.id,
                                title: (item.shortPlayName || item.title || '').replace(/<[^>]*>/g, ''), // Strip HTML
                                cover: item.shortPlayCover || item.cover,
                                description: item.shotIntroduce || item.desc,
                                source: 'netshort'
                            })),
                            hasMore: false
                        };
                    })
            );
        }

        // Melolo - fetch all and paginate client-side
        if (page === 1) { // Only fetch on first page
            promises.push(
                fetchWithRetry(`${API_BASE}/melolo/search?query=${encodeURIComponent(query)}`)
                    .then(data => {
                        if (!data) return { source: 'melolo', items: [], hasMore: false };
                        let items: any[] = [];
                        if (data.data?.search_data && Array.isArray(data.data.search_data)) {
                            data.data.search_data.forEach((block: any) => {
                                if (block.books && Array.isArray(block.books)) {
                                    items.push(...block.books);
                                }
                            });
                        } else if (data.books) {
                            items = data.books;
                        } else if (data.data?.books) {
                            items = data.data.books;
                        }

                        return {
                            source: 'melolo',
                            items: items.map((item: any) => {
                                let cover = item.cover_url || item.thumb_url || item.cover || '';
                                if (cover.includes('.heic')) {
                                    cover = `https://images.weserv.nl/?url=${encodeURIComponent(cover)}&output=webp&q=85`;
                                }
                                return {
                                    id: item.book_id || item.id,
                                    title: item.book_name || item.title,
                                    cover: cover,
                                    description: item.abstract || item.summary,
                                    source: 'melolo'
                                };
                            }),
                            hasMore: false
                        };
                    })
            );
        }

        const results = await Promise.all(promises);

        // Combine all results
        const allItems = results.flatMap(r => r.items);

        // Check if any source has more data
        const hasMore = results.some(r => r.hasMore) || (page === 1 && allItems.length >= size);

        // Paginate combined results
        const startIndex = (page - 1) * size;
        const endIndex = startIndex + size;
        const paginatedResults = allItems.slice(startIndex, endIndex);

        return new Response(JSON.stringify({
            results: paginatedResults,
            page,
            size,
            total: allItems.length,
            hasMore,
            sources: results.map(r => ({
                source: r.source,
                count: r.items.length,
                hasMore: r.hasMore
            }))
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
