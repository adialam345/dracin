import type { UnifiedDrama } from '../adapter';
import { Providers, safeExecute, dramaDetailsCache } from './common';

export async function fetchAggregatedSearch(query: string, providerFilter?: string): Promise<UnifiedDrama[]> {
    if (!query) return [];

    const tasks = getSearchTasks(query, providerFilter);
    const results = await Promise.all(tasks.map(t => t.task()));

    // Cache items
    results.forEach(list => {
        if (list) {
            list.forEach(i => dramaDetailsCache.set(i.source + '_' + i.id, i));
        }
    });

    let candidates: UnifiedDrama[] = [];
    const filteredResults = results.filter((r): r is UnifiedDrama[] => !!r);

    // Interleave Logic
    const maxLen = Math.max(...filteredResults.map(r => r.length), 0);
    for (let i = 0; i < maxLen; i++) {
        filteredResults.forEach(list => {
            if (list[i]) candidates.push(list[i]);
        });
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

// Map for streaming search
export function getSearchTasks(query: string, providerFilter?: string) {
    const {
        Dramabox, Netshort, Melolo, RadReel, DramaWave, FlickReels, DramaDash,
        ShortMax, StarShort, FreeShort, HiShort, GoodShort, DotDrama,
        StardustTV, ReelLife, Meloshort, Vigloo
    } = Providers;

    const allTasks = [
        { id: 'dramabox', name: 'Dramabox', task: () => safeExecute(Dramabox.searchDramabox(query), 'Dramabox') },
        { id: 'netshort', name: 'Netshort', task: () => safeExecute(Netshort.searchNetshort(query), 'Netshort') },
        { id: 'melolo', name: 'Melolo', task: () => safeExecute(Melolo.searchMelolo(query), 'Melolo') },
        { id: 'radreel', name: 'RadReel', task: () => safeExecute(RadReel.searchRadReel(query), 'RadReel') },
        { id: 'dramawave', name: 'DramaWave', task: () => safeExecute(DramaWave.searchDramaWave(query), 'DramaWave') },
        { id: 'dramaflickreels', name: 'FlickReels', task: () => safeExecute(FlickReels.searchFlickReels(query), 'FlickReels') },
        { id: 'dramadash', name: 'DramaDash', task: () => safeExecute(DramaDash.searchDramaDash(query), 'DramaDash') },
        { id: 'shortmax', name: 'ShortMax', task: () => safeExecute(ShortMax.searchShortMax(query), 'ShortMax') },
        { id: 'starshort', name: 'StarShort', task: () => safeExecute(StarShort.searchStarShort(query), 'StarShort') },
        { id: 'freeshort', name: 'FreeShort', task: () => safeExecute(FreeShort.searchFreeShort(query), 'FreeShort') },
        { id: 'hishort', name: 'HiShort', task: () => safeExecute(HiShort.searchHiShort(query), 'HiShort') },
        { id: 'goodshort', name: 'GoodShort', task: () => safeExecute(GoodShort.searchGoodShort(query), 'GoodShort') },
        { id: 'dotdrama', name: 'DotDrama', task: () => safeExecute(DotDrama.searchDotDrama(query), 'DotDrama') },
        { id: 'stardusttv', name: 'StardustTV', task: () => safeExecute(StardustTV.searchStardustTV(query), 'StardustTV') },
        { id: 'reelife', name: 'ReelLife', task: () => safeExecute(ReelLife.searchReelLife(query), 'ReelLife') },
        { id: 'meloshort', name: 'Meloshort', task: () => safeExecute(Meloshort.searchMeloshort(query), 'Meloshort') },
        { id: 'vigloo', name: 'Vigloo', task: () => safeExecute(Vigloo.searchVigloo(query), 'Vigloo') }
    ];

    if (providerFilter && providerFilter !== 'all') {
        const filtered = allTasks.filter(t => t.id === providerFilter.toLowerCase());
        if (filtered.length > 0) return filtered;
    }

    return allTasks;
}
