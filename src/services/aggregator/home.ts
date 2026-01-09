import type { UnifiedDrama } from '../adapter';
import { withCache } from '../utils';
import { Providers, safeExecute, shuffle, dramaDetailsCache } from './common';

export async function fetchAggregatedHome(): Promise<{ forYou: UnifiedDrama[], trending: UnifiedDrama[], latest: UnifiedDrama[] }> {
    const {
        Dramabox, Netshort, Melolo, RadReel, DramaWave, FlickReels, DramaDash,
        ShortMax, StarShort, FreeShort, HiShort, GoodShort, DotDrama,
        StardustTV, ReelLife, Meloshort, Vigloo
    } = Providers;

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
        fsForYou,
        hsForYou,
        gsForYou,
        dotdForYou,
        sdtvForYou,
        rlForYou,
        msForYou,
        vForYou
    ] = await Promise.all([
        safeExecute(withCache('db_foryou', () => Dramabox.getDramaboxForYou()), 'Dramabox ForYou'),
        safeExecute(withCache('db_trending', () => Dramabox.getDramaboxTrending()), 'Dramabox Trending'),
        safeExecute(withCache('db_latest', () => Dramabox.getDramaboxLatest()), 'Dramabox Latest'),
        safeExecute(withCache('ns_foryou', () => Netshort.getNetshortForYou()), 'Netshort ForYou'),
        safeExecute(withCache('ml_trending', () => Melolo.getMeloloTrending()), 'Melolo Trending'),
        safeExecute(withCache('ml_latest', () => Melolo.getMeloloLatest()), 'Melolo Latest'),
        safeExecute(withCache('rr_home', () => RadReel.getRadReelForYou()), 'RadReel ForYou'),
        safeExecute(withCache('dw_home', () => DramaWave.getDramaWaveForYou()), 'DramaWave ForYou'),
        safeExecute(withCache('fr_home', () => FlickReels.getFlickReelsForYou()), 'FlickReels ForYou'),
        safeExecute(withCache('dd_home', () => DramaDash.getDramaDashForYou()), 'DramaDash ForYou'),
        safeExecute(withCache('sm_home', () => ShortMax.getShortMaxForYou()), 'ShortMax ForYou'),
        safeExecute(withCache('ss_home', () => StarShort.getStarShortForYou()), 'StarShort ForYou'),
        safeExecute(withCache('fs_home', () => FreeShort.getFreeShortForYou()), 'FreeShort ForYou'),
        safeExecute(withCache('hs_home', () => HiShort.getHiShortHome()), 'HiShort ForYou'),
        safeExecute(withCache('gs_home', () => GoodShort.getGoodShortHome()), 'GoodShort ForYou'),
        safeExecute(withCache('dotd_home', () => DotDrama.getDotDramaForYou()), 'DotDrama ForYou'),
        safeExecute(withCache('sdtv_home', () => StardustTV.getStardustTVForYou()), 'StardustTV ForYou'),
        safeExecute(withCache('rl_home', () => ReelLife.getReelLifeForYou()), 'ReelLife ForYou'),
        safeExecute(withCache('ms_home', () => Meloshort.getMeloshortForYou()), 'Meloshort ForYou'),
        safeExecute(withCache('v_home', () => Vigloo.getViglooHome()), 'Vigloo ForYou'),
    ]);

    // Cache items for Detail fallback
    const cacheItems = (items: UnifiedDrama[]) => items.forEach(i => dramaDetailsCache.set(i.source + '_' + i.id, i));
    [dbForYou, dbTrending, dbLatest, nsForYou, mlTrending, mlLatest, rrForYou, dwForYou, frForYou, ddForYou, smForYou, ssForYou, fsForYou, hsForYou, gsForYou, dotdForYou, sdtvForYou, rlForYou, msForYou, vForYou].forEach(list => cacheItems(list || []));

    const allForYou = shuffle([...dbForYou, ...nsForYou.slice(0, 5), ...rrForYou, ...dwForYou, ...frForYou, ...ddForYou, ...smForYou, ...ssForYou, ...fsForYou, ...hsForYou, ...gsForYou, ...dotdForYou, ...sdtvForYou, ...rlForYou, ...msForYou, ...vForYou]).slice(0, 18);
    const allTrending = shuffle([...dbTrending, ...mlTrending]).slice(0, 12);
    const allLatest = shuffle([...dbLatest, ...mlLatest]).slice(0, 12);

    return { forYou: allForYou, trending: allTrending, latest: allLatest };
}
