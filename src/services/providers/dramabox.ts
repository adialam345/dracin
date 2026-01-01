import { fetchCached, API_BASE } from '../utils';
import { normalizeAny, type UnifiedDrama } from '../adapter';

export async function getDramaboxForYou(): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/dramabox/foryou');
    return extractList(data);
}

export async function getDramaboxTrending(): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/dramabox/trending');
    return extractList(data);
}

export async function getDramaboxLatest(): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/dramabox/latest');
    return extractList(data);
}

export async function searchDramabox(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/dramabox/search?query=' + encodeURIComponent(query) + '&page=1&size=30');
    return extractList(data);
}

export async function getDramaboxDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    const detailUrl = API_BASE + '/dramabox/detail?bookId=' + id;
    const episodesUrl = API_BASE + '/dramabox/allepisode?bookId=' + id;

    const [detailData, episodesData] = await Promise.all([
        fetchCached(detailUrl),
        fetchCached(episodesUrl)
    ]);

    const book = detailData?.data?.book;
    if (!book) return { drama: null, episodes: [] };

    const dramaInfo = {
        title: book.bookName,
        cover: book.cover,
        description: book.introduction,
        chapterCount: book.chapterCount,
        labels: book.labels || [],
        viewCount: book.viewCount,
        performerList: book.performerList,
        source: 'dramabox'
    };

    const episodes = detailData.data?.chapterList || [];
    return { drama: dramaInfo, episodes };
}

function extractList(data: any): UnifiedDrama[] {
    if (!data) return [];
    let items: any[] = [];
    if (Array.isArray(data)) items = data;
    else if (data.data && Array.isArray(data.data)) items = data.data;
    else if (data.columnVoList) {
        data.columnVoList.forEach((col: any) => {
            if (col.bookList) items.push(...col.bookList);
        });
    } else if (data.bookList) {
        items = data.bookList;
    }

    return items.map(item => normalizeAny(item, 'dramabox')).filter(i => i.id);
}
