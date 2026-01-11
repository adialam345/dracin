import type { UnifiedDrama } from '../adapter';
import { withCache } from '../utils';
import { Providers, shuffle, dramaDetailsCache } from './common';

export async function fetchAggregatedCategory(slug: string): Promise<UnifiedDrama[]> {
    const { Dramabox, Melolo, DramaWave, ShortMax, FlickReels, Netshort, Vigloo } = Providers;
    let list: UnifiedDrama[] = [];

    if (slug === 'trending') {
        const [db, ml] = await Promise.all([Dramabox.getDramaboxTrending(), Melolo.getMeloloTrending()]);
        list = [...db, ...ml];
    } else if (slug === 'terbaru') {
        const [db, ml] = await Promise.all([Dramabox.getDramaboxLatest(), Melolo.getMeloloLatest()]);
        list = [...db, ...ml];
    } else if (slug === 'vip') {
        // Collect VIP/Premium content from multiple providers
        const [dw, sm, fr, db, v] = await Promise.all([
            withCache('dw_home', () => DramaWave.getDramaWaveForYou()),
            withCache('sm_home', () => ShortMax.getShortMaxForYou()),
            withCache('fr_home', () => FlickReels.getFlickReelsForYou()),
            Dramabox.getDramaboxForYou(),
            withCache('v_home', () => Vigloo.getViglooHome())
        ]);
        list = [...dw, ...sm, ...fr, ...db, ...v];
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
