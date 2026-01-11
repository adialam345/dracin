import type { UnifiedDrama } from '../adapter';
import { withCache } from '../utils';
import { Providers, shuffle, dramaDetailsCache } from './common';

export async function fetchAggregatedCategory(slug: string): Promise<UnifiedDrama[]> {
    const { Dramabox, Melolo, DramaWave, ShortMax, FlickReels, Flick, Netshort, Vigloo } = Providers;
    let list: UnifiedDrama[] = [];

    if (slug === 'trending') {
        const [db, ml, fl] = await Promise.all([Dramabox.getDramaboxTrending(), Melolo.getMeloloTrending(), Flick.getFlickTrending()]);
        list = [...db, ...ml, ...fl];
    } else if (slug === 'terbaru') {
        const [db, ml, fl] = await Promise.all([Dramabox.getDramaboxLatest(), Melolo.getMeloloLatest(), Flick.getFlickTrending()]);
        list = [...db, ...ml, ...fl];
    } else if (slug === 'vip') {
        // Collect VIP/Premium content from multiple providers
        const [dw, sm, fr, db, v, fl] = await Promise.all([
            withCache('dw_home', () => DramaWave.getDramaWaveForYou()),
            withCache('sm_home', () => ShortMax.getShortMaxForYou()),
            withCache('fr_home', () => FlickReels.getFlickReelsForYou()),
            Dramabox.getDramaboxForYou(),
            withCache('v_home', () => Vigloo.getViglooHome()),
            withCache('flick_home', () => Flick.getFlickHome())
        ]);
        list = [...dw, ...sm, ...fr, ...db, ...v, ...fl];
    } else {
        // Fallback
        const [db, ns, v] = await Promise.all([
            Dramabox.getDramaboxForYou(),
            Netshort.getNetshortForYou(),
            withCache('v_home', () => Vigloo.getViglooHome())
        ]);
        list = [...db, ...ns, ...v];
    }

    list.forEach(i => dramaDetailsCache.set(i.source + '_' + i.id, i));
    return shuffle(list);
}
