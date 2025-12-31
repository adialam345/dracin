import { normalizeAny, normalizeRadReel, type UnifiedDrama } from './adapter';

const API_BASE = 'https://api.sansekai.my.id/api';

// Simple in-memory cache for server-side requests (expires in 2 minutes)
const serverCache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // Increased to 5 minutes

// Cache for basic drama info found in lists (fallback for when detail API fails)
const dramaDetailsCache = new Map<string, UnifiedDrama>();

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
                console.warn('[fetchFromEndpoint] rate limited(429) for: ' + url + '. Backing off...');
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

const RADREEL_HEADERS = {
    'Host': 'cdp.wolftv.online',
    'language': '4',
    'User-Agent': 'RadReel/2.7.0 (iPhone; iOS 17.0.3; Scale/3.00)',
    'version-str': '2.7.0',
    'release': 'iOS 17.0.3',
    'country': 'ID',
    'user-token': 'N4gAYsSN7cNoqVsbIg92YYrZQ8jPjgrNrHa7Q+61ITNc2wgryful8ZYNBtXFoVKZ4bqo2BesFhOA092iI/WSNWajH6wmQIfOdZLPh8rejxD6fxO0cq2U+n1ZqzbJoSi4QvKGM6vCh821fvYO71MQoLzSNqDCW/aJLBgdkYXklrMa49WLbAxTkw+0iglllxX4G3ovi7+57qIucQXz3aWE3XPmIzdfp4NaYbQhCMX5bokCw2n6MJYEFAylo9l2PId08/dFRoZja5kh/l827Fv2YUEsjRCJfrQo4RasswkR03TCxB/mO51HFHgbsmIwjcUn5cDa+hr04ZqE5gutrlMwuw==',
    'client-id': '1045'
};

async function fetchRadReel(endpoint: string): Promise<any> {
    try {
        const response = await fetch(endpoint, { headers: RADREEL_HEADERS });
        if (response.ok) {
            const data = await response.json();
            // Check for specific RadReel error codes
            // Error example: {"code":"cdp-common-9","msg":"Record does not exist"}
            if (data.code && data.code !== '0' && data.code !== 200) {
                console.warn('[fetchRadReel] API Error: ' + JSON.stringify(data));
                return null;
            }
            return data;
        }
    } catch (e) {
        console.error('[fetchRadReel] Error:', e);
    }
    return null;
}

export async function fetchAggregatedHome(): Promise<{ forYou: UnifiedDrama[], trending: UnifiedDrama[], latest: UnifiedDrama[] }> {
    // Parallel cached fetch from all providers
    const [
        dbForYou, dbTrending, dbLatest,
        nsForYou,
        mlTrending, mlLatest,
        rrForYou
    ] = await Promise.all([
        fetchCached(API_BASE + '/dramabox/foryou'),
        fetchCached(API_BASE + '/dramabox/trending'),
        fetchCached(API_BASE + '/dramabox/latest'),
        fetchCached(API_BASE + '/netshort/foryou?page=1&size=10'),
        fetchCached(API_BASE + '/melolo/trending'),
        fetchCached(API_BASE + '/melolo/latest'),
        fetchRadReel('https://cdp.wolftv.online/cdp/compilations_recommend_slot/for_you_recommended?index=0'),
    ]);

    // Mix and Match Logic
    const allForYou = [
        ...extractList(dbForYou, 'dramabox'),
        ...extractList(nsForYou, 'netshort').slice(0, 5),
        ...extractList(rrForYou, 'radreel'),
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
function extractList(data: any, provider: 'dramabox' | 'netshort' | 'melolo' | 'radreel'): UnifiedDrama[] {
    if (!data) return [];
    let items: any[] = [];

    // RadReel Structure Detection
    if (provider === 'radreel') {
        if (data.forYoucompilationsList) items = data.forYoucompilationsList;
        else if (Array.isArray(data)) items = data;
    }
    // NetShort Structure Detection
    else if (provider === 'netshort') {
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
        // console.log('[Aggregator] 0 items extracted for ' + provider);
        return [];
    }

    const normalized = items.map(item => normalizeAny(item, provider)).filter(i => i.id);

    // Cache items for fallback use
    normalized.forEach(item => {
        dramaDetailsCache.set(provider + '_' + item.id, item);
    });

    console.log('[Aggregator] Extracted ' + normalized.length + ' items for ' + provider);
    return normalized;
};

export async function fetchAggregatedSearch(query: string): Promise<UnifiedDrama[]> {
    if (!query) return [];

    // Use cached search with larger size for Dramabox to get more candidates
    const [dbSearch, nsSearch, mlSearch, rrSearch] = await Promise.all([
        fetchCached(API_BASE + '/dramabox/search?query=' + encodeURIComponent(query) + '&page=1&size=30'),
        fetchCached(API_BASE + '/netshort/search?query=' + encodeURIComponent(query)),
        fetchCached(API_BASE + '/melolo/search?query=' + encodeURIComponent(query)),
        // RadReel has internal fetcher
        fetchRadReel('https://cdp.wolftv.online/cdp/server_api/compilations/search_detail/v2?keyword=' + encodeURIComponent(query) + '&pageNumber=1&pageSize=20'),
    ]);

    const dbList = extractList(dbSearch, 'dramabox');
    const nsList = extractList(nsSearch, 'netshort');
    const mlList = extractList(mlSearch, 'melolo');
    const rrList = extractList(rrSearch, 'radreel');

    // Combine all raw candidates
    let candidates: UnifiedDrama[] = [];

    // Interleave Logic
    const maxLen = Math.max(dbList.length, nsList.length, mlList.length, rrList.length);
    for (let i = 0; i < maxLen; i++) {
        if (dbList[i]) candidates.push(dbList[i]);
        if (nsList[i]) candidates.push(nsList[i]);
        if (mlList[i]) candidates.push(mlList[i]);
        if (rrList[i]) candidates.push(rrList[i]);
    }

    // Deduplicate by id
    const seen = new Set();
    candidates = candidates.filter(item => {
        const id = item.source + '-' + item.id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    // Client-side fuzzy boost: Check if title actually contains the query
    // This helps if the API sort order is weird
    const lowerQuery = query.toLowerCase();
    const exactMatches: UnifiedDrama[] = [];
    const looseMatches: UnifiedDrama[] = [];

    candidates.forEach(item => {
        if (item.title.toLowerCase().includes(lowerQuery)) {
            exactMatches.push(item);
        } else {
            looseMatches.push(item);
        }
    });

    // Return exact/close matches first, then others
    return [...exactMatches, ...looseMatches];
}

export async function fetchAggregatedCategory(slug: string): Promise<UnifiedDrama[]> {
    const promises: Promise<any>[] = [];
    const providers: Array<'dramabox' | 'netshort' | 'melolo' | 'radreel'> = [];

    // Map slug to endpoints
    if (slug === 'trending') {
        promises.push(fetchFromEndpoint(API_BASE + '/dramabox/trending'));
        providers.push('dramabox');
        promises.push(fetchFromEndpoint(API_BASE + '/melolo/trending'));
        providers.push('melolo');
    } else if (slug === 'terbaru') {
        promises.push(fetchFromEndpoint(API_BASE + '/dramabox/latest'));
        providers.push('dramabox');
        promises.push(fetchFromEndpoint(API_BASE + '/melolo/latest'));
        providers.push('melolo');
    } else if (slug === 'vip') {
        promises.push(fetchFromEndpoint(API_BASE + '/dramabox/vip'));
        providers.push('dramabox');
    } else {
        // Fallback or generic recommendation
        promises.push(fetchFromEndpoint(API_BASE + '/dramabox/foryou'));
        providers.push('dramabox');
        promises.push(fetchFromEndpoint(API_BASE + '/netshort/foryou'));
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
        // RadReel Special Case
        if (source === 'radreel') {
            // Unpack composite ID: fakeId_compilationsId
            const parts = id.split('_');
            const fakeId = parts[0];
            const compilationsId = parts[1] || '';
            const metadataUrl = 'https://cdp.wolftv.online/content/compilations/v2/' + fakeId;

            // 1. Try Cache First
            let cached = dramaDetailsCache.get('radreel_' + id);

            // 2. If no cache, try to "Bootstrap" via Metadata + Search
            if (!cached) {
                console.log('[RadReel] Cache miss for ' + id + ', bootstrapping...');
                const metadata = await fetchRadReel(metadataUrl);
                if (metadata && metadata.title) {
                    // Search by title to find the "List Item" which contains the videoUrl
                    const searchUrl = 'https://cdp.wolftv.online/cdp/server_api/compilations/search_detail/v2?keyword=' + encodeURIComponent(metadata.title) + '&pageNumber=1&pageSize=5';
                    const searchResults = await fetchRadReel(searchUrl);
                    if (searchResults && Array.isArray(searchResults)) {
                        // Find match
                        const match = searchResults.find((item: any) => item.fakeId === fakeId || item.compilationsFakeId === fakeId);
                        if (match) {
                            const normalized = normalizeRadReel(match);
                            // Prefer metadata info as it is full detail and clean
                            if (metadata.title) normalized.title = metadata.title;
                            if (metadata.introduce) normalized.description = metadata.introduce;
                            dramaDetailsCache.set('radreel_' + id, normalized);
                            cached = normalized;
                        }
                    }

                    // If search failed but we have metadata, at least show metadata (no video)
                    if (!cached) {
                        cached = {
                            id: id,
                            title: metadata.title,
                            cover: metadata.coverImgUrl,
                            description: metadata.introduce,
                            source: 'radreel',
                            raw: metadata
                        } as UnifiedDrama;
                    }
                }
            }

            // 3. Construct Response from Cached/Bootstrapped data
            if (cached) {
                const hasDirectVideo = cached.raw?.videoUrl;
                const dramaInfo = {
                    title: cached.title,
                    cover: cached.cover,
                    description: cached.description || '',
                    chapterCount: hasDirectVideo ? 1 : 0,
                    labels: cached.raw?.compilationsTags || [],
                    viewCount: cached.raw?.shareTimes || 0,
                    source: 'radreel'
                };

                let episodes: any[] = [];

                // NEW: Fetch full episode list from the newly discovered endpoint
                // Endpoint: https://cdp.wolftv.online/content/state_res/episodic_movie/movies/{fakeId}
                const episodeListUrl = 'https://cdp.wolftv.online/content/state_res/episodic_movie/movies/' + fakeId;
                const episodeData = await fetchRadReel(episodeListUrl);

                if (episodeData && Array.isArray(episodeData)) {
                    console.log('[Aggregator] Found ' + episodeData.length + ' episodes for RadReel/' + id);
                    episodes = episodeData.map((ep: any, index: number) => ({
                        id: ep.videoFakeId, // Use videoFakeId as unique ID
                        name: 'Episode ' + (index + 1),
                        index: index,
                        unlock: !ep.lock,
                        raw: ep
                    }));
                    // Update chapter count based on actual episodes found
                    dramaInfo.chapterCount = episodes.length;
                } else if (hasDirectVideo) {
                    // Fallback to single "Play" episode if list API fails but we have a direct link
                    episodes.push({
                        id: '0',
                        name: 'Putar Film',
                        index: 0,
                        unlock: true,
                        raw: { videoUrl: cached.raw.videoUrl }
                    });
                }

                return { drama: dramaInfo, episodes };
            }

            return { drama: null, episodes: [] };
        }

        // Special case for DramaBox: Parallel fetch detail and allepisode to warm up cache
        if (source === 'dramabox') {
            const detailUrl = API_BASE + '/dramabox/detail?bookId=' + id;
            const episodesUrl = API_BASE + '/dramabox/allepisode?bookId=' + id;

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
            ? API_BASE + '/netshort/allepisode?shortPlayId=' + id
            : API_BASE + '/melolo/detail?bookId=' + id;

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
                    cover = 'https://images.weserv.nl/?url=' + encodeURIComponent(cover) + '&output=webp&q=85';
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
        console.error(`[fetchUnifiedDramaData] Error: `, e);
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
            const allEpisodeLinks = await fetchCached(API_BASE + '/dramabox/allepisode?bookId=' + bookId);
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
            const data = await fetchCached(API_BASE + '/melolo/stream?bookId=' + bookId + '&videoId=' + episodeId);
            if (!data) return '';
            videoUrl = data.data?.main_url || '';
            // Force HTTPS for Melolo to avoid mixed content issues
            if (videoUrl && videoUrl.startsWith('http://')) {
                videoUrl = videoUrl.replace('http://', 'https://');
            }
        } else if (source === 'netshort') {
            const data = await fetchCached(API_BASE + '/netshort/allepisode?shortPlayId=' + bookId);
            if (!data) return '';
            const ep = (data.shortPlayEpisodeInfos || []).find((e: any) => e.episodeId === episodeId);
            videoUrl = ep?.playVoucher || '';
        } else if (source === 'radreel') {
            // Priority 1: Check for direct list-provided videoUrl (mapped to episode '0')
            if (episodeId === '0') {
                const cached = dramaDetailsCache.get('radreel_' + bookId);
                if (cached && cached.raw?.videoUrl) {
                    console.log('[Aggregator] Using direct list videoUrl for RadReel/' + bookId);
                    return cached.raw.videoUrl;
                }
            }

            // Priority 2: Use the new episode list endpoint to find the video
            // Endpoint: https://cdp.wolftv.online/content/state_res/episodic_movie/movies/{fakeId}
            const parts = bookId.split('_');
            const fakeId = parts[0];
            const url = 'https://cdp.wolftv.online/content/state_res/episodic_movie/movies/' + fakeId;
            const data = await fetchRadReel(url);

            if (data && Array.isArray(data)) {
                const ep = data.find((e: any) => e.videoFakeId === episodeId);
                if (ep) {
                    // It seems the list endpoint doesn't return direct videoUrls in the array (based on user curl),
                    // but let's check if we need to call detail for that specific video or if it's constructed.
                    // Actually, the previous debug for detail endpoint might still be needed if `definitionList` isn't here.
                    // Let's assume for now we might need to fetch the individual video detail OR check if `playUrl` exists.

                    // IF the list doesn't have videoURL, we might need to fetch detail for this specific episode.
                    // But based on user curl, we only saw metadata.
                    // Let's TRY constructing a detail call request for this single video if specific fields are missing.

                    if (ep.videoUrl) videoUrl = ep.videoUrl;
                    else {
                        // Attempt to fetch detail for this specific video
                        const videoDetailUrl = 'https://cdp.wolftv.online/content/movie/v5/' + ep.videoFakeId + '?compilationsId=' + ep.compilationsId + '&episodicDramaId=' + (ep.id) + '&videoFakeId=' + ep.videoFakeId;
                        const detailData = await fetchRadReel(videoDetailUrl);

                        if (detailData) {
                            // Check if definitionList is directly available OR if it's inside videoFiles array properties
                            // Based on debug script, detailData.videoFiles is an ARRAY of definitions directly.
                            // Example: [{definition: 'SD', url: '...'}, {definition: 'HD', url: '...'}]
                            let list = [];

                            if (Array.isArray(detailData.videoFiles)) {
                                // Case 1: videoFiles is the list itself
                                list = detailData.videoFiles;
                            } else if (detailData.definitionList) {
                                // Case 2: standard definitionList
                                list = detailData.definitionList;
                            } else if (detailData.videoFiles && Array.isArray(detailData.videoFiles.definitionList)) {
                                // Case 3: Nested
                                list = detailData.videoFiles.definitionList;
                            }

                            if (list.length > 0) {
                                // "definition" can be localized (e.g., Chinese "高清"), so relying on 'SD' string is flaky.
                                // Just grab the first available URL, preferring 'videoUrl' or 'url'.
                                // The object keys from debug: definition, duration, videoUri, videoUrl, ...
                                const target = list.find((d: any) => d.definition === 'SD') || list[0];
                                videoUrl = target.videoUrl || target.url || target.videoUri || '';

                                // HACK: wsvideo.wolftv.online often has CORS issues. 
                                // cfvideo.wolftv.online seems more permissive. Try swapping if present.
                                if (videoUrl.includes('wsvideo.wolftv.online')) {
                                    videoUrl = videoUrl.replace('wsvideo.wolftv.online', 'cfvideo.wolftv.online');
                                }
                            }
                        }
                    }
                }
            }
        }

        console.log('[Aggregator] Video URL for ' + source + '/' + bookId + '/' + episodeId + ': ' + (videoUrl ? 'FOUND' : 'NOT FOUND'));
        return videoUrl;
    } catch (e) {
        console.error('Error fetching video URL:', e);
    }
    return '';
}
