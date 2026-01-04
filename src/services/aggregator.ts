import { fetchCached, API_BASE, withCache } from './utils';
import { type UnifiedDrama } from './adapter';

// Import Providers
import * as Dramabox from './providers/dramabox';
import * as Netshort from './providers/netshort';
import * as Melolo from './providers/melolo';
import * as RadReel from './providers/radreel';
import * as DramaWave from './providers/dramawave';
import * as FlickReels from './providers/dramaflickreels';
import * as DramaDash from './providers/dramadash';
import * as ShortMax from './providers/shortmax';
import * as StarShort from './providers/starshort';
import * as FreeShort from './providers/freeshort';

// Helper for shuffling
const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5);

const dramaDetailsCache = new Map<string, UnifiedDrama>();
const episodeDetailsCache = new Map<string, any[]>();


// --- AGGREGATION FUNCTIONS ---

export async function fetchAggregatedHome(): Promise<{ forYou: UnifiedDrama[], trending: UnifiedDrama[], latest: UnifiedDrama[] }> {
    const [
        dbForYou, dbTrending, dbLatest,
        nsForYou,
        mlTrending, mlLatest,
        rrForYou,
        dwForYou,
        frForYou,
        ddForYou,
        smForYou,
        ssForYou,
        fsForYou
    ] = await Promise.all([
        Dramabox.getDramaboxForYou(),
        Dramabox.getDramaboxTrending(),
        Dramabox.getDramaboxLatest(),
        Netshort.getNetshortForYou(),
        Melolo.getMeloloTrending(),
        Melolo.getMeloloLatest(),
        withCache('rr_home', () => RadReel.getRadReelForYou()),
        withCache('dw_home', () => DramaWave.getDramaWaveForYou()),
        withCache('fr_home', () => FlickReels.getFlickReelsForYou()),
        withCache('dd_home', () => DramaDash.getDramaDashForYou()),
        withCache('sm_home', () => ShortMax.getShortMaxForYou()),
        withCache('ss_home', () => StarShort.getStarShortForYou()),
        withCache('fs_home', () => FreeShort.getFreeShortForYou()),
    ]);

    // Cache items for Detail fallback
    // Cache items for Detail fallback
    const cacheItems = (items: UnifiedDrama[]) => items.forEach(i => dramaDetailsCache.set(i.source + '_' + i.id, i));
    [dbForYou, dbTrending, dbLatest, nsForYou, mlTrending, mlLatest, rrForYou, dwForYou, frForYou, ddForYou, smForYou, ssForYou, fsForYou].forEach(list => cacheItems(list || []));

    // const ssForYou = (await Promise.resolve(StarShort.getStarShortForYou())) || []; // Removed redundant call
    // cacheItems(ssForYou);

    const allForYou = shuffle([...dbForYou, ...nsForYou.slice(0, 5), ...rrForYou, ...dwForYou, ...frForYou, ...ddForYou, ...smForYou, ...ssForYou, ...fsForYou]);
    const allTrending = shuffle([...dbTrending, ...mlTrending]);
    const allLatest = shuffle([...dbLatest, ...mlLatest]);

    return { forYou: allForYou, trending: allTrending, latest: allLatest };
}

export async function fetchAggregatedSearch(query: string): Promise<UnifiedDrama[]> {
    if (!query) return [];

    const [dbList, nsList, mlList, rrList, dwList, frList, ddList, smList, ssList, fsList] = await Promise.all([
        Dramabox.searchDramabox(query),
        Netshort.searchNetshort(query),
        Melolo.searchMelolo(query),
        RadReel.searchRadReel(query),
        DramaWave.searchDramaWave(query, 20), // Fetch up to 20 pages
        FlickReels.searchFlickReels(query),
        DramaDash.searchDramaDash(query),
        ShortMax.searchShortMax(query),
        StarShort.searchStarShort(query),
        FreeShort.searchFreeShort(query)
    ]);

    // Cache items
    [dbList, nsList, mlList, rrList, dwList, frList, ddList, smList, ssList, fsList].forEach(list => list.forEach(i => dramaDetailsCache.set(i.source + '_' + i.id, i)));

    let candidates: UnifiedDrama[] = [];

    // Interleave Logic
    const maxLen = Math.max(dbList.length, nsList.length, mlList.length, rrList.length, dwList.length, frList.length, ddList.length, smList.length, ssList.length, fsList.length);
    for (let i = 0; i < maxLen; i++) {
        if (dbList[i]) candidates.push(dbList[i]);
        if (nsList[i]) candidates.push(nsList[i]);
        if (mlList[i]) candidates.push(mlList[i]);
        if (rrList[i]) candidates.push(rrList[i]);
        if (dwList[i]) candidates.push(dwList[i]);
        if (frList[i]) candidates.push(frList[i]);
        if (ddList[i]) candidates.push(ddList[i]);
        if (smList[i]) candidates.push(smList[i]);
        if (ssList[i]) candidates.push(ssList[i]);
        if (fsList[i]) candidates.push(fsList[i]);
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
    } else if (slug === 'vip') {
        // Collect VIP/Premium content from multiple providers
        const [dw, sm, fr, db] = await Promise.all([
            withCache('dw_home', () => DramaWave.getDramaWaveForYou()),
            withCache('sm_home', () => ShortMax.getShortMaxForYou()),
            withCache('fr_home', () => FlickReels.getFlickReelsForYou()),
            Dramabox.getDramaboxForYou() // Already cached internally
        ]);
        list = [...dw, ...sm, ...fr, ...db];
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
        case 'dramaflickreels':
            const frResult = await FlickReels.getFlickReelsDetail(id);
            if (!frResult.drama && cached) {
                return {
                    drama: {
                        title: cached.title,
                        cover: cached.cover,
                        description: cached.description || '',
                        chapterCount: cached.chapterCount || 0,
                        labels: [],
                        source: 'dramaflickreels'
                    },
                    episodes: []
                };
            }
            if (frResult.episodes) {
                episodeDetailsCache.set(source + '_' + id, frResult.episodes);
            }
            return frResult;
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
        case 'dramadash':
            return DramaDash.getDramaDashDetail(id);
        case 'shortmax':
            const smCover = cached ? cached.cover : undefined;
            // Use withCache for the detail call too? Maybe just for the fetch.
            // But getShortMaxDetail is complex. Let's just pass the cover.
            // If we cache the whole result, we save even more.
            const smResult = await withCache(`sm_detail_v2_${id}`, () => ShortMax.getShortMaxDetail(id, smCover), 10 * 60 * 1000);

            // Check if result is valid
            if ((!smResult || !smResult.drama) && cached) {
                return {
                    drama: {
                        title: cached.title,
                        cover: cached.cover,
                        description: cached.description || '',
                        chapterCount: 0,
                        labels: [],
                        source: 'shortmax'
                    },
                    episodes: []
                };
            }
            return smResult || { drama: null, episodes: [] };
        case 'starshort':
            return StarShort.getStarShortDetail(id);
        case 'freeshort':
            return (await FreeShort.getFreeShortDetail(id)) || { drama: null, episodes: [] };
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
                console.log('[Aggregator] DramaWave episode raw data:', JSON.stringify(episode.raw, null, 2));

                videoUrl = episode.raw.h264_m3u8 ||
                    episode.raw.h265_m3u8 ||
                    episode.raw.external_audio_h264_m3u8 ||
                    episode.raw.external_audio_h265_m3u8 ||
                    episode.raw.video_url ||
                    episode.raw.videoUrl ||
                    '';

                console.log('[Aggregator] DramaWave video URL found:', videoUrl ? 'YES' : 'NO', videoUrl.substring(0, 100));

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
            } else {
                console.error('[Aggregator] DramaWave episode not found or has no raw data. Episode ID:', episodeId, 'Available episodes:', episodes.map(e => e.id));
            }
        } else if (source === 'dramaflickreels') {
            // Priority: Check cache for batched unlock URL
            const cachedEps = episodeDetailsCache.get('dramaflickreels_' + bookId);
            let foundInCache = false;

            if (cachedEps) {
                const ep = cachedEps.find(e => String(e.id) === String(episodeId));
                if (ep && ep.raw && ep.raw.hls_url) {
                    videoUrl = ep.raw.hls_url;
                    foundInCache = true;
                }
            }

            // Fallback: Web API Play (if cache miss or batch unlock failed)
            if (!foundInCache) {
                videoUrl = await FlickReels.getFlickReelsVideoUrl(bookId, episodeId);
            }
        } else if (source === 'dramadash') {
            const { episodes } = await DramaDash.getDramaDashDetail(bookId);
            const ep = episodes.find(e => String(e.id) === String(episodeId));
            if (ep && ep.raw && ep.raw.videoUrl) {
                videoUrl = ep.raw.videoUrl;
                // Add subtitles if present
                if (ep.raw.subtitles && Array.isArray(ep.raw.subtitles)) {
                    return JSON.stringify({
                        videoUrl: videoUrl,
                        subtitles: ep.raw.subtitles.map((sub: any) => ({
                            label: sub.languageDisplayName || sub.language,
                            lang: sub.language,
                            url: sub.url
                        }))
                    });
                }
            }
        } else if (source === 'shortmax') {
            // episodeId format: "{dramaId}_{episodeNum}" e.g., "14643_1"
            const parts = episodeId.split('_');
            const episodeNum = parts.length > 1 ? parseInt(parts[parts.length - 1]) : 1;

            // Use dedicated function to get signed video URL with auth_key
            // Cache video URL for 45 minutes (token usually valid for ~60m)
            videoUrl = await withCache(`sm_video_${bookId}_${episodeNum}`, () => ShortMax.getShortMaxVideoUrl(bookId, episodeNum), 45 * 60 * 1000);

            // Fallback to episode list if direct call failed
            if (!videoUrl) {
                const result = await ShortMax.getShortMaxDetail(bookId);
                if (result && result.episodes) {
                    const ep = result.episodes.find(e => String(e.id) === String(episodeId));
                    if (ep && ep.raw && ep.raw.videoUrl) {
                        videoUrl = ep.raw.videoUrl;
                    }
                }
            }
        } else if (source === 'starshort') {
            // Identical logic to RadReel but with StarShort fetcher and domains
            // Priority 1: Check cache/direct
            if (episodeId === '0') {
                const cached = dramaDetailsCache.get('starshort_' + bookId);
                if (cached && cached.raw?.videoUrl) return cached.raw.videoUrl;
            }

            // Priority 2: Use list endpoint to find match
            const parts = bookId.split('_');
            const fakeId = parts[0];
            const url = 'https://cdp.starshort.online/content/state_res/episodic_movie/movies/' + fakeId;
            const data = await StarShort.fetchStarShort(url);

            if (data && Array.isArray(data)) {
                const ep = data.find((e: any) => e.videoFakeId === episodeId);
                if (ep) {
                    if (ep.videoUrl) videoUrl = ep.videoUrl;
                    else {
                        // Attempt to fetch detail
                        const videoDetailUrl = 'https://cdp.starshort.online/content/movie/v5/' + ep.videoFakeId + '?compilationsId=' + ep.compilationsId + '&episodicDramaId=' + (ep.id) + '&videoFakeId=' + ep.videoFakeId;
                        const detailData = await StarShort.fetchStarShort(videoDetailUrl);

                        if (detailData) {
                            let list = [];
                            if (Array.isArray(detailData.videoFiles)) list = detailData.videoFiles;
                            else if (detailData.definitionList) list = detailData.definitionList;
                            else if (detailData.videoFiles?.definitionList) list = detailData.videoFiles.definitionList;

                            if (list.length > 0) {
                                const target = list.find((d: any) => d.definition === 'SD') || list[0];
                                videoUrl = target.videoUrl || target.url || target.videoUri || '';
                            }
                        }
                    }
                }
            }
        } else if (source === 'freeshort') {
            const parts = episodeId.split('_');
            const episodeNum = parts.length > 1 ? parseInt(parts[parts.length - 1]) : 1;
            videoUrl = await FreeShort.getFreeShortVideoUrl(bookId, episodeNum);
        }

        console.log('[Aggregator] Video URL for ' + source + '/' + bookId + '/' + episodeId + ': ' + (videoUrl ? 'FOUND' : 'NOT FOUND'));
        return videoUrl;

    } catch (e) {
        console.error('Error fetching video URL:', e);
    }
    return '';
}
