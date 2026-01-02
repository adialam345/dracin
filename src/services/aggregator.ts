import { fetchCached, API_BASE } from './utils';
import { type UnifiedDrama } from './adapter';

// Import Providers
import * as Dramabox from './providers/dramabox';
import * as Netshort from './providers/netshort';
import * as Melolo from './providers/melolo';
import * as RadReel from './providers/radreel';
import * as DramaWave from './providers/dramawave';

// Helper for shuffling
const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5);

// Cache for basic drama info found in lists (redundancy for detail fetch)
// In a perfect world this lives in a shared cache manager, but module-scope map works fine for now.
const dramaDetailsCache = new Map<string, UnifiedDrama>();

// --- AGGREGATION FUNCTIONS ---

export async function fetchAggregatedHome(): Promise<{ forYou: UnifiedDrama[], trending: UnifiedDrama[], latest: UnifiedDrama[] }> {
    const [
        dbForYou, dbTrending, dbLatest,
        nsForYou,
        mlTrending, mlLatest,
        rrForYou,
        dwForYou
    ] = await Promise.all([
        Dramabox.getDramaboxForYou(),
        Dramabox.getDramaboxTrending(),
        Dramabox.getDramaboxLatest(),
        Netshort.getNetshortForYou(),
        Melolo.getMeloloTrending(),
        Melolo.getMeloloLatest(),
        RadReel.getRadReelForYou(),
        DramaWave.getDramaWaveForYou(),
    ]);

    // Cache items for Detail fallback
    const cacheItems = (items: UnifiedDrama[]) => items.forEach(i => dramaDetailsCache.set(i.source + '_' + i.id, i));
    [dbForYou, dbTrending, dbLatest, nsForYou, mlTrending, mlLatest, rrForYou, dwForYou].forEach(list => cacheItems(list));

    const allForYou = shuffle([...dbForYou, ...nsForYou.slice(0, 5), ...rrForYou, ...dwForYou]);
    const allTrending = shuffle([...dbTrending, ...mlTrending]);
    const allLatest = shuffle([...dbLatest, ...mlLatest]);

    return { forYou: allForYou, trending: allTrending, latest: allLatest };
}

export async function fetchAggregatedSearch(query: string): Promise<UnifiedDrama[]> {
    if (!query) return [];

    const [dbList, nsList, mlList, rrList, dwList] = await Promise.all([
        Dramabox.searchDramabox(query),
        Netshort.searchNetshort(query),
        Melolo.searchMelolo(query),
        RadReel.searchRadReel(query),
        DramaWave.searchDramaWave(query, 20), // Fetch up to 20 pages
    ]);

    // Cache items
    [dbList, nsList, mlList, rrList, dwList].forEach(list => list.forEach(i => dramaDetailsCache.set(i.source + '_' + i.id, i)));

    let candidates: UnifiedDrama[] = [];

    // Interleave Logic
    const maxLen = Math.max(dbList.length, nsList.length, mlList.length, rrList.length, dwList.length);
    for (let i = 0; i < maxLen; i++) {
        if (dbList[i]) candidates.push(dbList[i]);
        if (nsList[i]) candidates.push(nsList[i]);
        if (mlList[i]) candidates.push(mlList[i]);
        if (rrList[i]) candidates.push(rrList[i]);
        if (dwList[i]) candidates.push(dwList[i]);
    }

    // Deduplicate
    const seen = new Set();
    candidates = candidates.filter(item => {
        const id = item.source + '-' + item.id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    // Fuzzy sort
    const lowerQuery = query.toLowerCase();
    const exactMatches: UnifiedDrama[] = [];
    const looseMatches: UnifiedDrama[] = [];

    candidates.forEach(item => {
        if (item.title.toLowerCase().includes(lowerQuery)) exactMatches.push(item);
        else looseMatches.push(item);
    });

    return [...exactMatches, ...looseMatches];
}

export async function fetchAggregatedCategory(slug: string): Promise<UnifiedDrama[]> {
    let list: UnifiedDrama[] = [];

    if (slug === 'trending') {
        const [db, ml] = await Promise.all([Dramabox.getDramaboxTrending(), Melolo.getMeloloTrending()]);
        list = [...db, ...ml];
    } else if (slug === 'terbaru') {
        const [db, ml] = await Promise.all([Dramabox.getDramaboxLatest(), Melolo.getMeloloLatest()]);
        list = [...db, ...ml];
    } else {
        // Fallback
        const [db, ns] = await Promise.all([Dramabox.getDramaboxForYou(), Netshort.getNetshortForYou()]);
        list = [...db, ...ns];
    }

    list.forEach(i => dramaDetailsCache.set(i.source + '_' + i.id, i));
    return shuffle(list);
}

// --- UNIFIED DETAIL & PLAYBACK ---

export async function fetchUnifiedDramaData(source: string, id: string): Promise<{ drama: any, episodes: any[] }> {
    // Try to get cached metadata for fallback
    const cached = dramaDetailsCache.get(source + '_' + id);

    switch (source) {
        case 'dramabox':
            return Dramabox.getDramaboxDetail(id);
        case 'netshort':
            return Netshort.getNetshortDetail(id);
        case 'melolo':
            return Melolo.getMeloloDetail(id);
        case 'radreel':
            return RadReel.getRadReelDetail(id);
        case 'dramawave':
            // Inject cache into provider logic if possible, or just rely on API
            // For now, we replicate the specific logic or move it to provider
            // The provider implementation handles API fetch. We can wire cache injection if we modify provider signature,
            // but for simplicity, let's trust the provider's fresh fetch.
            // If provider returns null, we can fallback to 'cached' here if we want.
            const result = await DramaWave.getDramaWaveDetail(id);
            if (!result.drama && cached) {
                return {
                    drama: {
                        title: cached.title,
                        cover: cached.cover,
                        description: cached.description || '',
                        chapterCount: 1,
                        labels: [],
                        source: 'dramawave'
                    },
                    episodes: [{
                        id: id,
                        name: 'Putar Video',
                        index: 0,
                        unlock: true,
                        raw: cached.raw
                    }]
                };
            }
            return result;
        default:
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
            if (videoUrl && videoUrl.startsWith('http://')) {
                videoUrl = videoUrl.replace('http://', 'https://');
            }
        } else if (source === 'netshort') {
            const data = await fetchCached(API_BASE + '/netshort/allepisode?shortPlayId=' + bookId);
            if (!data) return '';
            const ep = (data.shortPlayEpisodeInfos || []).find((e: any) => e.episodeId === episodeId);
            videoUrl = ep?.playVoucher || '';

            // Handle subtitles if available
            if (ep && ep.subtitleList && Array.isArray(ep.subtitleList) && ep.subtitleList.length > 0) {
                return JSON.stringify({
                    videoUrl: videoUrl,
                    subtitles: ep.subtitleList.map((sub: any) => ({
                        label: sub.subtitleLanguage === 'id_ID' ? 'Indonesia' : sub.subtitleLanguage,
                        lang: sub.subtitleLanguage || 'id-ID',
                        url: sub.url
                    }))
                });
            }
        } else if (source === 'radreel') {
            // Priority 1: Check cache/direct
            if (episodeId === '0') {
                const cached = dramaDetailsCache.get('radreel_' + bookId);
                if (cached && cached.raw?.videoUrl) return cached.raw.videoUrl;
            }

            // Priority 2: Use list endpoint to find match
            // Endpoint: https://cdp.wolftv.online/content/state_res/episodic_movie/movies/{fakeId}
            const parts = bookId.split('_');
            const fakeId = parts[0];
            const url = 'https://cdp.wolftv.online/content/state_res/episodic_movie/movies/' + fakeId;
            const data = await RadReel.fetchRadReel(url);

            if (data && Array.isArray(data)) {
                const ep = data.find((e: any) => e.videoFakeId === episodeId);
                if (ep) {
                    if (ep.videoUrl) videoUrl = ep.videoUrl;
                    else {
                        // Attempt to fetch detail
                        const videoDetailUrl = 'https://cdp.wolftv.online/content/movie/v5/' + ep.videoFakeId + '?compilationsId=' + ep.compilationsId + '&episodicDramaId=' + (ep.id) + '&videoFakeId=' + ep.videoFakeId;
                        const detailData = await RadReel.fetchRadReel(videoDetailUrl);

                        if (detailData) {
                            let list = [];
                            if (Array.isArray(detailData.videoFiles)) list = detailData.videoFiles;
                            else if (detailData.definitionList) list = detailData.definitionList;
                            else if (detailData.videoFiles?.definitionList) list = detailData.videoFiles.definitionList;

                            if (list.length > 0) {
                                const target = list.find((d: any) => d.definition === 'SD') || list[0];
                                videoUrl = target.videoUrl || target.url || target.videoUri || '';
                                if (videoUrl.includes('wsvideo.wolftv.online')) {
                                    videoUrl = videoUrl.replace('wsvideo.wolftv.online', 'cfvideo.wolftv.online');
                                }
                            }
                        }
                    }
                }
            }
        } else if (source === 'dramawave') {
            // We re-fetch info to ensure fresh signed URL (or use cache if we implement thorough detailed caching)
            // Currently logic is to re-call detail API which returns signed URLs in episode list
            const { episodes } = await DramaWave.getDramaWaveDetail(bookId);
            const episode = episodes.find(e => String(e.id) === String(episodeId));

            if (episode && episode.raw) {
                videoUrl = episode.raw.h265_m3u8 ||
                    episode.raw.h264_m3u8 ||
                    episode.raw.external_audio_h265_m3u8 ||
                    episode.raw.external_audio_h264_m3u8 ||
                    '';

                if (episode.raw.subtitle_list && Array.isArray(episode.raw.subtitle_list)) {
                    return JSON.stringify({
                        videoUrl: videoUrl,
                        subtitles: episode.raw.subtitle_list.map((sub: any) => ({
                            label: sub.display_name,
                            lang: sub.language,
                            url: sub.subtitle
                        }))
                    });
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
