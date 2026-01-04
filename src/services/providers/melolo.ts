import { fetchCached, API_BASE } from '../utils';
import { normalizeAny, type UnifiedDrama } from '../adapter';

export async function getMeloloTrending(): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/melolo/trending');
    return extractList(data);
}

export async function getMeloloLatest(): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/melolo/latest');
    return extractList(data);
}

export async function searchMelolo(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/melolo/search?query=' + encodeURIComponent(query));
    return extractList(data);
}

export async function getMeloloDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    const url = API_BASE + '/melolo/detail?bookId=' + id;
    const data = await fetchCached(url);
    if (!data) return { drama: null, episodes: [] };

    let dramaInfo: any = null;
    const videoData = data.data?.video_data;
    if (videoData?.series_title) {
        let cover = videoData?.series_cover || '';
        if (cover && cover.includes('.heic')) {
            cover = 'https://images.weserv.nl/?url=' + encodeURIComponent(cover) + '&output=webp&q=85';
        }
        dramaInfo = {
            title: videoData?.series_title,
            cover: cover,
            description: videoData?.series_intro,
            chapterCount: videoData?.episode_cnt,
            labels: [],
            source: 'melolo'
        };
    }

    const episodes = (data.data?.video_data?.video_list || []).map((ep: any, idx: number) => ({
        id: ep.vid,
        name: '', // ep.title often contains full synopsis/intro which is too long
        index: idx,
        unlock: true
    }));

    return { drama: dramaInfo, episodes };
}

function extractList(data: any): UnifiedDrama[] {
    if (!data) return [];
    let items: any[] = [];
    if (data.data?.search_data) { // Search Result (Blocks)
        const blocks = data.data.search_data;
        if (Array.isArray(blocks)) {
            blocks.forEach((b: any) => {
                if (b.books && Array.isArray(b.books)) {
                    items.push(...b.books);
                }
            });
        }
    }
    else if (data.data?.series_list) items = data.data.series_list; // Melolo Search Results
    else if (data.books) items = data.books; // Trending/Category
    else if (data.results) items = data.results;
    else if (Array.isArray(data)) items = data;

    return items.map(item => normalizeAny(item, 'melolo')).filter(i => i.id);
}
