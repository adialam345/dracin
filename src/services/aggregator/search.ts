import type { UnifiedDrama } from '../adapter';
import { Providers, safeExecute, dramaDetailsCache } from './common';

export async function fetchAggregatedSearch(query: string): Promise<UnifiedDrama[]> {
    if (!query) return [];

    const {
        Dramabox, Netshort, Melolo, RadReel, DramaWave, FlickReels, DramaDash,
        ShortMax, StarShort, FreeShort, HiShort, GoodShort, DotDrama,
        StardustTV, ReelLife, Meloshort
    } = Providers;

    const [dbList, nsList, mlList, rrList, dwList, frList, ddList, smList, ssList, fsList, hsList, gsList, dotdList, sdtvList, rlList, msList] = await Promise.all([
        safeExecute(Dramabox.searchDramabox(query), 'Dramabox Search'),
        safeExecute(Netshort.searchNetshort(query), 'Netshort Search'),
        safeExecute(Melolo.searchMelolo(query), 'Melolo Search'),
        safeExecute(RadReel.searchRadReel(query), 'RadReel Search'),
        safeExecute(DramaWave.searchDramaWave(query), 'DramaWave Search'),
        safeExecute(FlickReels.searchFlickReels(query), 'FlickReels Search'),
        safeExecute(DramaDash.searchDramaDash(query), 'DramaDash Search'),
        safeExecute(ShortMax.searchShortMax(query), 'ShortMax Search'),
        safeExecute(StarShort.searchStarShort(query), 'StarShort Search'),
        safeExecute(FreeShort.searchFreeShort(query), 'FreeShort Search'),
        safeExecute(HiShort.searchHiShort(query), 'HiShort Search'),
        safeExecute(GoodShort.searchGoodShort(query), 'GoodShort Search'),
        safeExecute(DotDrama.searchDotDrama(query), 'DotDrama Search'),
        safeExecute(StardustTV.searchStardustTV(query), 'StardustTV Search'),
        safeExecute(ReelLife.searchReelLife(query), 'ReelLife Search'),
        safeExecute(Meloshort.searchMeloshort(query), 'Meloshort Search')
    ]);

    // Cache items
    [dbList, nsList, mlList, rrList, dwList, frList, ddList, smList, ssList, fsList, hsList, gsList, dotdList, sdtvList, rlList, msList].forEach(list => list.forEach(i => dramaDetailsCache.set(i.source + '_' + i.id, i)));

    let candidates: UnifiedDrama[] = [];

    // Interleave Logic
    const maxLen = Math.max(dbList.length, nsList.length, mlList.length, rrList.length, dwList.length, frList.length, ddList.length, smList.length, ssList.length, fsList.length, hsList.length, gsList.length, dotdList.length, sdtvList.length, rlList.length, msList.length);
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
        if (hsList[i]) candidates.push(hsList[i]);
        if (gsList[i]) candidates.push(gsList[i]);
        if (dotdList[i]) candidates.push(dotdList[i]);
        if (sdtvList[i]) candidates.push(sdtvList[i]);
        if (rlList[i]) candidates.push(rlList[i]);
        if (msList[i]) candidates.push(msList[i]);
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
export function getSearchTasks(query: string) {
    const {
        Dramabox, Netshort, Melolo, RadReel, DramaWave, FlickReels, DramaDash,
        ShortMax, StarShort, FreeShort, HiShort, GoodShort, DotDrama,
        StardustTV, ReelLife, Meloshort
    } = Providers;

    return [
        { name: 'Dramabox', task: () => safeExecute(Dramabox.searchDramabox(query), 'Dramabox') },
        { name: 'Netshort', task: () => safeExecute(Netshort.searchNetshort(query), 'Netshort') },
        { name: 'Melolo', task: () => safeExecute(Melolo.searchMelolo(query), 'Melolo') },
        { name: 'RadReel', task: () => safeExecute(RadReel.searchRadReel(query), 'RadReel') },
        { name: 'DramaWave', task: () => safeExecute(DramaWave.searchDramaWave(query), 'DramaWave') },
        { name: 'FlickReels', task: () => safeExecute(FlickReels.searchFlickReels(query), 'FlickReels') },
        { name: 'DramaDash', task: () => safeExecute(DramaDash.searchDramaDash(query), 'DramaDash') },
        { name: 'ShortMax', task: () => safeExecute(ShortMax.searchShortMax(query), 'ShortMax') },
        { name: 'StarShort', task: () => safeExecute(StarShort.searchStarShort(query), 'StarShort') },
        { name: 'FreeShort', task: () => safeExecute(FreeShort.searchFreeShort(query), 'FreeShort') },
        { name: 'HiShort', task: () => safeExecute(HiShort.searchHiShort(query), 'HiShort') },
        { name: 'GoodShort', task: () => safeExecute(GoodShort.searchGoodShort(query), 'GoodShort') },
        { name: 'DotDrama', task: () => safeExecute(DotDrama.searchDotDrama(query), 'DotDrama') },
        { name: 'StardustTV', task: () => safeExecute(StardustTV.searchStardustTV(query), 'StardustTV') },
        { name: 'ReelLife', task: () => safeExecute(ReelLife.searchReelLife(query), 'ReelLife') },
        { name: 'Meloshort', task: () => safeExecute(Meloshort.searchMeloshort(query), 'Meloshort') }
    ];
}
