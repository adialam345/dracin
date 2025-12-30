import { normalizeAny, type UnifiedDrama } from './adapter';

const API_BASE = 'https://api.sansekai.my.id/api';

// Simple in-memory cache for server-side requests (expires in 2 minutes)
const serverCache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // Increased to 5 minutes

// Global state to handle rate limiting
let globalBackoffuntil = 0;

async function fetchCached(url: string, retries: number = 3): Promise<any> {
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

async function fetchFromEndpoint(url: string, retries: number = 3, delay: number = 300): Promise<any> {
    for (let i = 0; i < retries; i++) {
        // Respect global backoff if active
        const now = Date.now();
        if (now < globalBackoffuntil) {
            await new Promise(resolve => setTimeout(resolve, globalBackoffuntil - now));
        }

        try {
            const response = await fetch(url);

            if (response.status === 429) {
                console.warn(`[fetchFromEndpoint] rate limited (429) for: ${url}. Backing off...`);
                // Set global backoff for 1-2 seconds to let the API breathe
                globalBackoffuntil = Date.now() + 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                continue;
            }

            if (response.ok) {
                const data = await response.json();

                // Flexible empty check
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

                // For search, an empty list is a valid result, don't retry.
                if (isSearch || !isEmpty) return data;
                console.warn(`[fetchFromEndpoint] Items empty for: ${url}. Retrying...`);
            }
        } catch (error) {
            console.error(`[fetchFromEndpoint] Error on attempt ${i + 1}:`, error);
        }

        if (i < retries - 1) {
            const waitTime = delay * Math.pow(2, i) + (Math.random() * 200);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return null;
}

export async function fetchAggregatedHome(): Promise<{ forYou: UnifiedDrama[], trending: UnifiedDrama[], latest: UnifiedDrama[] }> {
    // Parallel cached fetch from all providers
    const [
        dbForYou, dbTrending, dbLatest,
        nsForYou,
        mlTrending, mlLatest
    ] = await Promise.all([
        fetchCached(`${API_BASE}/dramabox/foryou`),
        fetchCached(`${API_BASE}/dramabox/trending`),
        fetchCached(`${API_BASE}/dramabox/latest`),
        fetchCached(`${API_BASE}/netshort/foryou?page=1&size=10`),
        fetchCached(`${API_BASE}/melolo/trending`),
        fetchCached(`${API_BASE}/melolo/latest`),
    ]);




    // Mix and Match Logic
    const allForYou = [
        ...extractList(dbForYou, 'dramabox'),
        ...extractList(nsForYou, 'netshort').slice(0, 5), // Take top 5 netshort
    ];

    const allTrending = [
        ...extractList(dbTrending, 'dramabox'),
        ...extractList(mlTrending, 'melolo'),
    ];

    const allLatest = [
        ...extractList(dbLatest, 'dramabox'),
        ...extractList(mlLatest, 'melolo'),
    ];

    // Shuffle arrays to mix providers (Fisher-Yates shuffle simplified)
    const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5);

    return {
        forYou: shuffle(allForYou),
        trending: shuffle(allTrending),
        latest: shuffle(allLatest),
    };
}

// Helper to extract items from different API structures
function extractList(data: any, provider: 'dramabox' | 'netshort' | 'melolo'): UnifiedDrama[] {
    if (!data) return [];
    let items: any[] = [];

    // NetShort Structure Detection
    if (provider === 'netshort') {
        if (data.searchCodeSearchResult) items = data.searchCodeSearchResult; // Search Result
        else if (data.contentInfos) items = data.contentInfos; // For You Endpoint
        else if (data.data?.list) items = data.data.list;
        else if (data.data && Array.isArray(data.data)) items = data.data;
        else if (Array.isArray(data)) items = data;
    }
    // Melolo Structure Detection
    else if (provider === 'melolo') {
        if (data.data?.search_data) { // Search Result (Blocks)
            const blocks = data.data.search_data;
            if (Array.isArray(blocks)) {
                blocks.forEach((b: any) => {
                    if (b.books && Array.isArray(b.books)) {
                        items.push(...b.books);
                    }
                });
            }
        }
        else if (data.data?.series_list) items = data.data.series_list; // Melolo Search Results
        else if (data.books) items = data.books; // Trending/Category
        else if (data.results) items = data.results;
        else if (Array.isArray(data)) items = data;
    }
    // Dramabox Structure Detection
    else {
        if (Array.isArray(data)) items = data;
        else if (data.data && Array.isArray(data.data)) items = data.data;
        else if (data.columnVoList) {
            data.columnVoList.forEach((col: any) => {
                if (col.bookList) items.push(...col.bookList);
            });
        } else if (data.bookList) {
            items = data.bookList;
        }
    }

    if (!items || items.length === 0) {
        console.log(`[Aggregator] 0 items extracted for ${provider}`);
        return [];
    }

    const normalized = items.map(item => normalizeAny(item, provider)).filter(i => i.id);
    console.log(`[Aggregator] Extracted ${normalized.length} items for ${provider}`);
    return normalized;
};

export async function fetchAggregatedSearch(query: string): Promise<UnifiedDrama[]> {
    if (!query) return [];

    // Use cached search to avoid frequent 429s on similar queries
    const [dbSearch, nsSearch, mlSearch] = await Promise.all([
        fetchCached(`${API_BASE}/dramabox/search?query=${encodeURIComponent(query)}`),
        fetchCached(`${API_BASE}/netshort/search?query=${encodeURIComponent(query)}`),
        fetchCached(`${API_BASE}/melolo/search?query=${encodeURIComponent(query)}`),
    ]);

    const dbList = extractList(dbSearch, 'dramabox');
    const nsList = extractList(nsSearch, 'netshort');
    const mlList = extractList(mlSearch, 'melolo');

    // Interleave results to show a mix of providers at the top
    const results: UnifiedDrama[] = [];
    const maxLen = Math.max(dbList.length, nsList.length, mlList.length);

    for (let i = 0; i < maxLen; i++) {
        if (dbList[i]) results.push(dbList[i]);
        if (nsList[i]) results.push(nsList[i]);
        if (mlList[i]) results.push(mlList[i]);
    }

    // Deduplicate by id to avoid clutter
    const seen = new Set();
    return results.filter(item => {
        const id = `${item.source}-${item.id}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

export async function fetchAggregatedCategory(slug: string): Promise<UnifiedDrama[]> {
    const promises: Promise<any>[] = [];
    const providers: Array<'dramabox' | 'netshort' | 'melolo'> = [];

    // Map slug to endpoints
    if (slug === 'trending') {
        promises.push(fetchFromEndpoint(`${API_BASE}/dramabox/trending`));
        providers.push('dramabox');
        promises.push(fetchFromEndpoint(`${API_BASE}/melolo/trending`));
        providers.push('melolo');
    } else if (slug === 'terbaru') {
        promises.push(fetchFromEndpoint(`${API_BASE}/dramabox/latest`));
        providers.push('dramabox');
        promises.push(fetchFromEndpoint(`${API_BASE}/melolo/latest`));
        providers.push('melolo');
    } else if (slug === 'vip') {
        promises.push(fetchFromEndpoint(`${API_BASE}/dramabox/vip`));
        providers.push('dramabox');
    } else {
        // Fallback or generic recommendation
        promises.push(fetchFromEndpoint(`${API_BASE}/dramabox/foryou`));
        providers.push('dramabox');
        promises.push(fetchFromEndpoint(`${API_BASE}/netshort/foryou`));
        providers.push('netshort');
    }

    const responses = await Promise.all(promises);
    let aggregated: UnifiedDrama[] = [];

    responses.forEach((data, index) => {
        aggregated.push(...extractList(data, providers[index]));
    });

    return aggregated.sort(() => Math.random() - 0.5);
}
/**
 * Combined function to fetch both drama detail and episodes in one go.
 * Since most providers return everything in a single detail call, this avoids duplicate network requests.
 */
export async function fetchUnifiedDramaData(source: string, id: string): Promise<{ drama: any, episodes: any[] }> {
    try {
        // Special case for DramaBox: Parallel fetch detail and allepisode to warm up cache
        if (source === 'dramabox') {
            const detailUrl = `${API_BASE}/dramabox/detail?bookId=${id}`;
            const episodesUrl = `${API_BASE}/dramabox/allepisode?bookId=${id}`;

            const [detailData, episodesData] = await Promise.all([
                fetchCached(detailUrl),
                fetchCached(episodesUrl)
            ]);

            const book = detailData?.data?.book;
            if (!book) return { drama: null, episodes: [] };

            const dramaInfo = {
                title: book.bookName,
                cover: book.cover,
                description: book.introduction,
                chapterCount: book.chapterCount,
                labels: book.labels || [],
                viewCount: book.viewCount,
                performerList: book.performerList,
                source: 'dramabox'
            };

            // Use detail chapterList as base, but could also merge with episodesData if needed
            const episodes = detailData.data?.chapterList || [];

            return { drama: dramaInfo, episodes };
        }

        const url = source === 'netshort'
            ? `${API_BASE}/netshort/allepisode?shortPlayId=${id}`
            : `${API_BASE}/melolo/detail?bookId=${id}`;

        const data = await fetchCached(url);
        if (!data) return { drama: null, episodes: [] };

        // 1. Process Drama Info
        let dramaInfo: any = null;
        if (source === 'netshort') {
            if (data.shortPlayName) {
                let labels = Array.isArray(data.shortPlayLabels) ? data.shortPlayLabels : (typeof data.shortPlayLabels === 'string' ? data.shortPlayLabels.split(',') : []);
                const stripHtml = (html: string) => html ? html.replace(/<[^>]*>/g, '') : '';
                dramaInfo = {
                    title: stripHtml(data.shortPlayName),
                    cover: data.shortPlayCover,
                    description: data.shotIntroduce,
                    chapterCount: data.totalEpisode,
                    labels: labels,
                    source: 'netshort'
                };
            }
        } else if (source === 'melolo') {
            const videoData = data.data?.video_data;
            if (videoData?.series_title) {
                let cover = videoData?.series_cover || '';
                if (cover && cover.includes('.heic')) {
                    cover = `https://images.weserv.nl/?url=${encodeURIComponent(cover)}&output=webp&q=85`;
                }
                dramaInfo = {
                    title: videoData?.series_title,
                    cover: cover,
                    description: videoData?.series_intro,
                    chapterCount: videoData?.episode_cnt,
                    labels: [],
                    source: 'melolo'
                };
            }
        } else {
            const book = data.data?.book;
            if (book?.bookName) {
                dramaInfo = {
                    title: book?.bookName,
                    cover: book?.cover,
                    description: book?.introduction,
                    chapterCount: book?.chapterCount,
                    labels: book?.labels || [],
                    viewCount: book?.viewCount,
                    performerList: book?.performerList,
                    source: 'dramabox'
                };
            }
        }

        // 2. Process Episodes
        let episodes: any[] = [];
        if (source === 'netshort') {
            episodes = (data.shortPlayEpisodeInfos || []).map((ep: any) => ({
                id: ep.episodeId,
                name: ep.shortPlayEpisodeName,
                index: ep.episodeNo - 1,
                unlock: !ep.isLock
            }));
        } else if (source === 'melolo') {
            episodes = (data.data?.video_data?.video_list || []).map((ep: any, idx: number) => ({
                id: ep.vid,
                name: ep.title,
                index: idx,
                unlock: true
            }));
        } else {
            episodes = data.data?.chapterList || [];
        }

        return { drama: dramaInfo, episodes };
    } catch (e) {
        console.error(`[fetchUnifiedDramaData] Error:`, e);
        return { drama: null, episodes: [] };
    }
}

export async function fetchUnifiedDetail(source: string, id: string): Promise<any> {
    const { drama } = await fetchUnifiedDramaData(source, id);
    return drama;
}

export async function fetchUnifiedEpisodes(source: string, id: string): Promise<any[]> {
    const { episodes } = await fetchUnifiedDramaData(source, id);
    return episodes;
}

export async function fetchVideoUrl(source: string, bookId: string, episodeId: string): Promise<string> {
    try {
        let videoUrl = '';
        if (source === 'dramabox') {
            const allEpisodeLinks = await fetchCached(`${API_BASE}/dramabox/allepisode?bookId=${bookId}`);
            if (!allEpisodeLinks) return '';
            const linkData = allEpisodeLinks.find((ep: any) => ep.chapterId === episodeId);

            if (linkData && linkData.cdnList && linkData.cdnList.length > 0) {
                const defaultCdn = linkData.cdnList.find((cdn: any) => cdn.isDefault === 1) || linkData.cdnList[0];
                if (defaultCdn && defaultCdn.videoPathList) {
                    const video720 = defaultCdn.videoPathList.find((v: any) => v.quality === 720);
                    const video1080 = defaultCdn.videoPathList.find((v: any) => v.quality === 1080);
                    const anyVideo = defaultCdn.videoPathList[0];
                    videoUrl = (video720 || video1080 || anyVideo)?.videoPath || '';
                }
            }
        } else if (source === 'melolo') {
            const data = await fetchCached(`${API_BASE}/melolo/stream?bookId=${bookId}&videoId=${episodeId}`);
            if (!data) return '';
            videoUrl = data.data?.main_url || '';
            // Force HTTPS for Melolo to avoid mixed content issues
            if (videoUrl && videoUrl.startsWith('http://')) {
                videoUrl = videoUrl.replace('http://', 'https://');
            }
        } else if (source === 'netshort') {
            const data = await fetchCached(`${API_BASE}/netshort/allepisode?shortPlayId=${bookId}`);
            if (!data) return '';
            const ep = (data.shortPlayEpisodeInfos || []).find((e: any) => e.episodeId === episodeId);
            videoUrl = ep?.playVoucher || '';
        }

        console.log(`[Aggregator] Video URL for ${source}/${bookId}/${episodeId}: ${videoUrl ? 'FOUND' : 'NOT FOUND'}`);
        return videoUrl;
    } catch (e) {
        console.error('Error fetching video URL:', e);
    }
    return '';
}
