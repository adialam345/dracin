import { Providers, dramaDetailsCache, episodeDetailsCache } from '../common';
import { withCache } from '../../utils';
import { wrapProxyImage } from '../../adapter';

export async function fetchUnifiedDramaData(source: string, id: string): Promise<{ drama: any, episodes: any[] }> {
    const {
        Dramabox, Netshort, Melolo, RadReel, FlickReels, DramaWave,
        DramaDash, ShortMax, StarShort, FreeShort, HiShort, GoodShort,
        DotDrama, StardustTV, ReelLife, Meloshort, Vigloo
    } = Providers;
    // Try to get cached metadata for fallback
    const cached = dramaDetailsCache.get(source + '_' + id);

    // Speed optimization: If we have cached basics from Home/Search,
    // we can return them immediately for certain providers while background fetching (conceptually).
    // In SSR, we can't background fetch but we can decide to trust the cache if it's there.
    if (cached && (cached.chapterCount ?? 0) > 0) {
        // For providers where we can reliably generate or have episodes cached
        const cachedEps = episodeDetailsCache.get(source + '_' + id);
        if (cachedEps && cachedEps.length > 0) {
            return { drama: cached, episodes: cachedEps };
        }

        // Generative fallback for simple providers
        if (['meloshort', 'dotdrama', 'vigloo', 'shortmax', 'freeshort', 'hishort', 'goodshort'].includes(source)) {
            const episodes = Array.from({ length: cached.chapterCount || 0 }, (_, i) => ({
                id: source === 'shortmax' ? `${id}_${i + 1}` : String(i + 1),
                name: 'Episode ' + (i + 1),
                index: i,
                unlock: true,
                raw: source === 'meloshort' ? { dramaId: id, episodeNum: i + 1 } : { id, episodeNum: i + 1 }
            }));
            return { drama: cached, episodes };
        }
    }

    const cacheKey = `unified_detail_v2_${source}_${id}`;
    const ttl = 30 * 60 * 1000; // 30 minutes

    const result = await withCache(cacheKey, async () => {
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
                const smResult = await ShortMax.getShortMaxDetail(id, smCover);

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
            case 'hishort':
                return (await HiShort.getHiShortDetail(id)) || { drama: null, episodes: [] };
            case 'goodshort':
                const gsResult = await GoodShort.getGoodShortDetail(id);
                if ((!gsResult || !gsResult.drama) && cached) {
                    return {
                        drama: {
                            title: cached.title,
                            cover: cached.cover,
                            description: cached.description || '',
                            chapterCount: cached.chapterCount || 0,
                            labels: [],
                            source: 'goodshort'
                        },
                        episodes: []
                    };
                }

                const finalDrama = (gsResult && gsResult.drama) ? gsResult.drama : (cached ? {
                    title: cached.title,
                    cover: cached.cover,
                    description: cached.description || '',
                    chapterCount: cached.chapterCount || 0,
                    labels: [],
                    source: 'goodshort'
                } : null);

                let finalEpisodes = (gsResult && gsResult.episodes && gsResult.episodes.length > 0) ? gsResult.episodes : [];

                if (finalEpisodes.length === 0 && finalDrama && finalDrama.chapterCount && finalDrama.chapterCount > 0) {
                    finalEpisodes = Array.from({ length: finalDrama.chapterCount }, (_, i) => ({
                        id: String(i + 1),
                        name: 'Episode ' + (i + 1),
                        index: i,
                        unlock: true
                    }));
                }

                return { drama: finalDrama, episodes: finalEpisodes };
            case 'dotdrama':
                return DotDrama.getDotDramaDetail(id);
            case 'stardusttv':
                return StardustTV.getStardustTVDetail(id);
            case 'reelife':
                const rlRes = await ReelLife.getReelLifeDetail(id);
                return rlRes || { drama: null, episodes: [] };
            case 'meloshort':
                const msRes = await Meloshort.getMeloshortDetail(id);
                return msRes || { drama: null, episodes: [] };
            case 'vigloo':
                const vRes = await Vigloo.getViglooDetail(id);
                return vRes || { drama: null, episodes: [] };
            default:
                return { drama: null, episodes: [] };
        }
    }, ttl);

    // Ensure cover is wrapped in proxy for caching and security
    if (result && result.drama && result.drama.cover) {
        result.drama.cover = wrapProxyImage(result.drama.cover);
    }

    return result;
}
