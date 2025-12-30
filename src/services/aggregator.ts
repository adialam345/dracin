import { normalizeAny, type UnifiedDrama } from './adapter';

const API_BASE = 'https://api.sansekai.my.id/api';

async function fetchFromEndpoint(url: string): Promise<any[]> {
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return [];
    }
}

export async function fetchAggregatedHome(): Promise<{ forYou: UnifiedDrama[], trending: UnifiedDrama[], latest: UnifiedDrama[] }> {
    // Parallel fetch from all providers
    const [
        dbForYou, dbTrending, dbLatest,
        nsForYou, nsTheaters,
        mlTrending, mlLatest
    ] = await Promise.all([
        fetchFromEndpoint(`${API_BASE}/dramabox/foryou`),
        fetchFromEndpoint(`${API_BASE}/dramabox/trending`),
        fetchFromEndpoint(`${API_BASE}/dramabox/latest`),
        fetchFromEndpoint(`${API_BASE}/netshort/foryou?page=1&size=10`), // Assuming structure
        fetchFromEndpoint(`${API_BASE}/netshort/theaters`),
        fetchFromEndpoint(`${API_BASE}/melolo/trending`),
        fetchFromEndpoint(`${API_BASE}/melolo/latest`),
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
    let items: any[] = [];

    // NetShort Structure Detection
    if (provider === 'netshort') {
        if (data.searchCodeSearchResult) items = data.searchCodeSearchResult; // Search Result
        else if (data.contentInfos) items = data.contentInfos; // For You Endpoint
        else if (data.data?.list) items = data.data.list;
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

    return items ? items.map(item => normalizeAny(item, provider)).filter(i => i.id) : [];
};

export async function fetchAggregatedSearch(query: string): Promise<UnifiedDrama[]> {
    if (!query) return [];

    const [dbSearch, nsSearch, mlSearch] = await Promise.all([
        fetchFromEndpoint(`${API_BASE}/dramabox/search?query=${encodeURIComponent(query)}`),
        fetchFromEndpoint(`${API_BASE}/netshort/search?query=${encodeURIComponent(query)}`), // Verify parameter name
        fetchFromEndpoint(`${API_BASE}/melolo/search?query=${encodeURIComponent(query)}`),
    ]);

    const results = [
        ...extractList(dbSearch, 'dramabox'),
        ...extractList(nsSearch, 'netshort'),
        ...extractList(mlSearch, 'melolo'),
    ];

    // Deduplicate by title to avoid clutter
    const seen = new Set();
    return results.filter(item => {
        const duplicate = seen.has(item.title.toLowerCase());
        seen.add(item.title.toLowerCase());
        return !duplicate;
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
    } else if (slug === 'dub-indo') {
        promises.push(fetchFromEndpoint(`${API_BASE}/dramabox/dubindo`));
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
export async function fetchUnifiedDetail(source: string, id: string): Promise<any> {
    const url = source === 'netshort'
        ? `${API_BASE}/netshort/allepisode?shortPlayId=${id}`
        : source === 'melolo'
            ? `${API_BASE}/melolo/detail?bookId=${id}`
            : `${API_BASE}/dramabox/detail?bookId=${id}`;

    try {
        console.log(`[fetchUnifiedDetail] Fetching ${source} detail for ID: ${id}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[fetchUnifiedDetail] HTTP ${response.status} for ${url}`);
            return null;
        }
        const data = await response.json();

        if (source === 'netshort') {
            // NetShort returns data directly at root level
            if (!data.shortPlayName) {
                console.error('[fetchUnifiedDetail] NetShort data missing shortPlayName:', data);
                return null;
            }

            // Convert labels array to comma-separated string if needed
            let labels = [];
            if (Array.isArray(data.shortPlayLabels)) {
                labels = data.shortPlayLabels;
            } else if (typeof data.shortPlayLabels === 'string') {
                labels = data.shortPlayLabels.split(',');
            }

            return {
                title: data.shortPlayName,
                cover: data.shortPlayCover,
                description: data.shotIntroduce,
                chapterCount: data.totalEpisode,
                labels: labels,
                source: 'netshort'
            };
        } else if (source === 'melolo') {
            const videoData = data.data?.video_data;
            if (!videoData?.series_title) {
                console.error('[fetchUnifiedDetail] Melolo data missing series_title:', data);
                return null;
            }
            let cover = videoData?.series_cover || '';
            // Use images.weserv.nl to convert HEIC to WebP
            if (cover && cover.includes('.heic')) {
                cover = `https://images.weserv.nl/?url=${encodeURIComponent(cover)}&output=webp&q=85`;
            }
            return {
                title: videoData?.series_title,
                cover: cover,
                description: videoData?.series_intro,
                chapterCount: videoData?.episode_cnt,
                labels: [],
                source: 'melolo'
            };
        } else {
            const book = data.data?.book;
            if (!book?.bookName) {
                console.error('[fetchUnifiedDetail] DramaBox data missing bookName:', data);
                return null;
            }
            return {
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
    } catch (e) {
        console.error('Error fetching detail:', e);
        return null;
    }
}

export async function fetchUnifiedEpisodes(source: string, id: string): Promise<any[]> {
    const url = source === 'netshort'
        ? `${API_BASE}/netshort/allepisode?shortPlayId=${id}`
        : source === 'melolo'
            ? `${API_BASE}/melolo/detail?bookId=${id}`
            : `${API_BASE}/dramabox/detail?bookId=${id}`;

    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();

        if (source === 'netshort') {
            return (data.shortPlayEpisodeInfos || []).map((ep: any) => ({
                id: ep.episodeId, // Use episodeId for links
                name: ep.shortPlayEpisodeName,
                index: ep.episodeNo - 1,
                unlock: !ep.isLock
            }));
        } else if (source === 'melolo') {
            return (data.data?.video_data?.video_list || []).map((ep: any, idx: number) => ({
                id: ep.vid, // Use vid for links
                name: ep.title,
                index: idx,
                unlock: true
            }));
        } else {
            return data.data?.chapterList || [];
        }
    } catch (e) {
        return [];
    }
}

export async function fetchVideoUrl(source: string, bookId: string, episodeId: string): Promise<string> {
    try {
        let videoUrl = '';
        if (source === 'dramabox') {
            const response = await fetch(`${API_BASE}/dramabox/allepisode?bookId=${bookId}`);
            if (!response.ok) return '';
            const allEpisodeLinks = await response.json();
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
            const response = await fetch(`${API_BASE}/melolo/stream?bookId=${bookId}&videoId=${episodeId}`);
            if (!response.ok) return '';
            const data = await response.json();
            videoUrl = data.data?.main_url || '';
            // Force HTTPS for Melolo to avoid mixed content issues
            if (videoUrl && videoUrl.startsWith('http://')) {
                videoUrl = videoUrl.replace('http://', 'https://');
            }
        } else if (source === 'netshort') {
            const response = await fetch(`${API_BASE}/netshort/allepisode?shortPlayId=${bookId}`);
            if (!response.ok) return '';
            const data = await response.json();
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
