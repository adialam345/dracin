export const API_BASE = 'https://api.sansekai.my.id/api';

// Simple in-memory cache for server-side requests
const serverCache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Global state to handle rate limiting
let globalBackoffuntil = 0;

export async function fetchCached(url: string, retries: number = 3): Promise<any> {
    const cached = serverCache.get(url);
    if (cached && cached.expiry > Date.now()) {
        return cached.data;
    }

    const data = await fetchFromEndpoint(url, retries);
    // Only cache successful, non-empty results
    if (data && (!Array.isArray(data) || data.length > 0)) {
        serverCache.set(url, { data, expiry: Date.now() + CACHE_TTL });
    }
    return data;
}

export async function fetchFromEndpoint(url: string, retries: number = 3, delay: number = 300): Promise<any> {
    for (let i = 0; i < retries; i++) {
        const now = Date.now();
        if (now < globalBackoffuntil) {
            await new Promise(resolve => setTimeout(resolve, globalBackoffuntil - now));
        }

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (response.status === 429) {
                console.warn('[fetchFromEndpoint] rate limited(429) for: ' + url + '. Backing off...');
                globalBackoffuntil = Date.now() + 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                continue;
            }

            if (response.ok) {
                const data = await response.json();

                // Flexible empty check for various API structures
                let items: any[] = [];
                if (Array.isArray(data)) items = data;
                else if (Array.isArray(data.data)) items = data.data;
                else if (data.data?.list) items = data.data.list;
                else if (data.data?.bookList) items = data.data.bookList;
                else if (data.bookList) items = data.bookList;
                else if (data.columnVoList) items = data.columnVoList;
                else if (data.contentInfos) items = data.contentInfos;
                else if (data.books) items = data.books;
                else if (data.shortPlayEpisodeInfos) items = data.shortPlayEpisodeInfos;

                const isDetailOrStream = url.includes('detail') || url.includes('stream') || url.includes('allepisode');
                const isSearch = url.includes('search');
                const isEmpty = (Array.isArray(items) && items.length === 0) && !isDetailOrStream;

                if (isSearch || !isEmpty) return data;
                console.warn('[fetchFromEndpoint] Items empty for: ' + url + '. Retrying...');
            }
        } catch (error) {
            console.error('[fetchFromEndpoint] Error on attempt ' + (i + 1) + ': ', error);
        }

        if (i < retries - 1) {
            const waitTime = delay * Math.pow(2, i) + (Math.random() * 200);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return null;
}
