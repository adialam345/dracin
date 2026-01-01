import { fetchCached, API_BASE } from '../utils';
import { normalizeAny, type UnifiedDrama } from '../adapter';

export async function getNetshortForYou(): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/netshort/foryou?page=1&size=10');
    return extractList(data);
}

export async function searchNetshort(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/netshort/search?query=' + encodeURIComponent(query));
    return extractList(data);
}

export async function getNetshortDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    const url = API_BASE + '/netshort/allepisode?shortPlayId=' + id;
    const data = await fetchCached(url);
    if (!data) return { drama: null, episodes: [] };

    let dramaInfo: any = null;
    if (data.shortPlayName) {
        let labels = Array.isArray(data.shortPlayLabels) ? data.shortPlayLabels : (typeof data.shortPlayLabels === 'string' ? data.shortPlayLabels.split(',') : []);
        const stripHtml = (html: string) => html ? html.replace(/<[^>]*>/g, '') : '';
        dramaInfo = {
            title: stripHtml(data.shortPlayName),
            cover: data.shortPlayCover,
            description: data.shotIntroduce,
            chapterCount: data.totalEpisode,
            labels: labels,
            source: 'netshort'
        };
    }

    const episodes = (data.shortPlayEpisodeInfos || []).map((ep: any) => ({
        id: ep.episodeId,
        name: ep.shortPlayEpisodeName,
        index: ep.episodeNo - 1,
        unlock: !ep.isLock
    }));

    return { drama: dramaInfo, episodes };
}

function extractList(data: any): UnifiedDrama[] {
    if (!data) return [];
    let items: any[] = [];
    if (data.searchCodeSearchResult) items = data.searchCodeSearchResult; // Search Result
    else if (data.contentInfos) items = data.contentInfos; // For You Endpoint
    else if (data.data?.list) items = data.data.list;
    else if (data.data && Array.isArray(data.data)) items = data.data;
    else if (Array.isArray(data)) items = data;

    return items.map(item => normalizeAny(item, 'netshort')).filter(i => i.id);
}
