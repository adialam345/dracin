import type { UnifiedDrama } from '../adapter';
import { withCache } from '../utils';
import { Providers, safeExecute, shuffle, dramaDetailsCache } from './common';

export async function fetchAggregatedHome(): Promise<{ forYou: UnifiedDrama[], trending: UnifiedDrama[], latest: UnifiedDrama[] }> {
    return withCache('aggregated_home_v2', async () => {
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
            safeExecute(Dramabox.getDramaboxForYou(), 'Dramabox ForYou'),
            safeExecute(Dramabox.getDramaboxTrending(), 'Dramabox Trending'),
            safeExecute(Dramabox.getDramaboxLatest(), 'Dramabox Latest'),
            safeExecute(Netshort.getNetshortForYou(), 'Netshort ForYou'),
            safeExecute(Melolo.getMeloloTrending(), 'Melolo Trending'),
            safeExecute(Melolo.getMeloloLatest(), 'Melolo Latest'),
            safeExecute(withCache('rr_home', () => RadReel.getRadReelForYou()), 'RadReel ForYou'),
            safeExecute(withCache('dw_home', () => DramaWave.getDramaWaveForYou()), 'DramaWave ForYou'),
            safeExecute(withCache('fr_home', () => FlickReels.getFlickReelsForYou()), 'FlickReels ForYou'),
            safeExecute(withCache('dd_home', () => DramaDash.getDramaDashForYou()), 'DramaDash ForYou'),
            safeExecute(withCache('sm_home', () => ShortMax.getShortMaxForYou()), 'ShortMax ForYou'),
            safeExecute(withCache('ss_home', () => StarShort.getStarShortForYou()), 'StarShort ForYou'),
            safeExecute(withCache('fs_home', () => FreeShort.getFreeShortForYou()), 'FreeShort ForYou'),
            safeExecute(withCache('hs_home_v2', () => HiShort.getHiShortHome()), 'HiShort ForYou'),
            safeExecute(withCache('gs_home', () => GoodShort.getGoodShortHome()), 'GoodShort ForYou'),
            safeExecute(withCache('dotd_home', () => DotDrama.getDotDramaForYou()), 'DotDrama ForYou'),
            safeExecute(withCache('sdtv_home', () => StardustTV.getStardustTVForYou()), 'StardustTV ForYou'),
            safeExecute(withCache('rl_home', () => ReelLife.getReelLifeForYou()), 'ReelLife ForYou'),
            safeExecute(withCache('ms_home', () => Meloshort.getMeloshortForYou()), 'Meloshort ForYou'),
            safeExecute(withCache('v_home', () => Vigloo.getViglooHome()), 'Vigloo ForYou')
        ]);

        // Cache items for Detail fallback
        const cacheItems = (items: UnifiedDrama[]) => items.forEach(i => dramaDetailsCache.set(i.source + '_' + i.id, i));
        [dbForYou, dbTrending, dbLatest, nsForYou, mlTrending, mlLatest, rrForYou, dwForYou, frForYou, ddForYou, smForYou, ssForYou, fsForYou, hsForYou, gsForYou, dotdForYou, sdtvForYou, rlForYou, msForYou, vForYou].forEach(list => cacheItems(list || []));

        const allForYou = shuffle([...dbForYou, ...nsForYou.slice(0, 5), ...rrForYou, ...dwForYou, ...frForYou, ...ddForYou, ...smForYou, ...ssForYou, ...fsForYou, ...hsForYou, ...gsForYou, ...dotdForYou, ...sdtvForYou, ...rlForYou, ...msForYou, ...vForYou]);
        const allTrending = shuffle([...dbTrending, ...mlTrending]);
        const allLatest = shuffle([...dbLatest, ...mlLatest]);

        return { forYou: allForYou, trending: allTrending, latest: allLatest };
    }, 2 * 60 * 60 * 1000); // Lock order for 2 hours
}

