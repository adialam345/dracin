import type { UnifiedDrama } from '../adapter';
import { withCache } from '../utils';
import { Providers, shuffle, dramaDetailsCache, safeExecute } from './common';

export async function fetchAggregatedCategory(slug: string): Promise<UnifiedDrama[]> {
    return withCache(`aggregated_category_${slug}_v1`, async () => {
        const {
            Dramabox, Melolo, DramaWave, ShortMax, FlickReels, Netshort,
            Vigloo, RadReel, StarShort, ReelLife, Meloshort, GoodShort
        } = Providers;
        let list: UnifiedDrama[] = [];

        try {
            if (slug === 'trending') {
                const results = await Promise.all([
                    safeExecute(Dramabox.getDramaboxTrending(), 'DramaboxTrending'),
                    safeExecute(Melolo.getMeloloTrending(), 'MeloloTrending'),
                    safeExecute(RadReel.getRadReelTrending(), 'RadReelTrending'),
                    safeExecute(FlickReels.getFlickReelsTrending(), 'FlickReelsTrending'),
                    safeExecute(Netshort.getNetshortTrending(), 'NetshortTrending'),
                    safeExecute(ShortMax.getShortMaxTrending(), 'ShortMaxTrending'),
                    safeExecute(StarShort.getStarShortTrending(), 'StarShortTrending'),
                    safeExecute(DramaWave.getDramaWaveTrending(), 'DramaWaveTrending'),
                    safeExecute(Vigloo.getViglooHome(), 'ViglooTrending'),
                    safeExecute(Meloshort.getMeloshortTrending(), 'MeloshortTrending'),
                    safeExecute(ReelLife.getReelLifeTrending(), 'ReelLifeTrending'),
                    safeExecute(GoodShort.getGoodShortTrending(), 'GoodShortTrending'),
                ]);
                list = results.flat();
            } else if (slug === 'terbaru') {
                const results = await Promise.all([
                    safeExecute(Dramabox.getDramaboxLatest(), 'DramaboxLatest'),
                    safeExecute(Melolo.getMeloloLatest(), 'MeloloLatest')
                ]);
                list = results.flat();
            } else if (slug === 'vip') {
                const results = await Promise.all([
                    safeExecute(withCache('dw_home', () => DramaWave.getDramaWaveForYou()), 'DramaWaveVIP'),
                    safeExecute(withCache('sm_home', () => ShortMax.getShortMaxForYou()), 'ShortMaxVIP'),
                    safeExecute(withCache('fr_home', () => FlickReels.getFlickReelsForYou()), 'FlickReelsVIP'),
                    safeExecute(Dramabox.getDramaboxForYou(), 'DramaboxVIP'),
                    safeExecute(withCache('v_home', () => Vigloo.getViglooHome()), 'ViglooVIP')
                ]);
                list = results.flat();
            } else {
                const results = await Promise.all([
                    safeExecute(Dramabox.getDramaboxForYou(), 'DramaboxHome'),
                    safeExecute(Netshort.getNetshortForYou(), 'NetshortHome'),
                    safeExecute(withCache('v_home', () => Vigloo.getViglooHome()), 'ViglooHome')
                ]);
                list = results.flat();
            }
        } catch (e) {
            console.error(`[Aggregator] Fatal error fetching category ${slug}:`, e);
        }

        if (!Array.isArray(list)) list = [];
        list.forEach(i => {
            if (i && i.id) dramaDetailsCache.set(i.source + '_' + i.id, i);
        });
        return shuffle(list);
    }, 2 * 60 * 60 * 1000); // 2 hours cache
}
