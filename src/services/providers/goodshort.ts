
import { normalizeGoodShort, type UnifiedDrama } from '../adapter';

const API_BASE = 'https://dramabos.asia/api/goodshort/api/v1';

async function fetchApi(path: string, params: Record<string, string> = {}) {
    const query = new URLSearchParams({ lang: 'in', ...params }).toString();
    const url = `${API_BASE}${path}?${query}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`[GoodShort] API Error ${response.status} for ${url}`);
            return null;
        }

        return await response.json();
    } catch (e) {
        console.error(`[GoodShort] Network Error for ${url}:`, e);
        return null;
    }
}

// --- Adapters ---

export async function getGoodShortHome(): Promise<UnifiedDrama[]> {
    const data = await fetchApi('/home', { channelId: '-1', page: '1', size: '20' });

    if (data && data.data && data.data.records) {
        const allDramas: UnifiedDrama[] = [];
        data.data.records.forEach((record: any) => {
            if (record.items && Array.isArray(record.items)) {
                record.items.forEach((item: any) => {
                    allDramas.push(normalizeGoodShort(item));
                });
            }
        });
        return allDramas;
    }

    return [];
}

export async function getGoodShortTrending(): Promise<UnifiedDrama[]> {
    const data = await fetchApi('/hot');

    if (data && data.data && Array.isArray(data.data)) {
        return data.data.map((item: any) => normalizeGoodShort({
            ...item,
            bookId: item.action,
            bookName: item.tags
        }));
    }

    return [];
}

export async function searchGoodShort(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchApi('/search', { q: query });
    if (data && data.data && data.data.searchResult && data.data.searchResult.records) {
        return data.data.searchResult.records.map((item: any) => normalizeGoodShort(item));
    }
    return [];
}

export async function getGoodShortDetail(id: string): Promise<{ drama: UnifiedDrama, episodes: any[], videoUrl?: string } | null> {
    const data = await fetchApi(`/book/${id}`);

    if (data && data.data && data.data.book) {
        const info = data.data.book;
        const chapters = data.data.list || [];

        const drama = normalizeGoodShort(info);

        const episodes = chapters.map((ch: any, idx: number) => ({
            id: ch.id?.toString(),
            name: ch.chapterName || `Episode ${idx + 1}`,
            index: idx,
            unlock: ch.price === 0,
            raw: ch
        }));

        return { drama, episodes };
    }

    return null;
}

export async function getGoodShortVideoUrl(bookId: string, episodeId: string): Promise<string> {
    const data = await fetchApi(`/book/${bookId}`);

    if (data && data.data && data.data.list) {
        const ep = data.data.list.find((e: any) => String(e.id) === String(episodeId));
        if (ep) {
            // Check cdnList or multiVideos
            if (ep.cdnList && ep.cdnList.length > 0 && ep.cdnList[0].videoPath) {
                return ep.cdnList[0].videoPath;
            }
            if (ep.multiVideos && ep.multiVideos.length > 0 && ep.multiVideos[0].filePath) {
                return ep.multiVideos[0].filePath;
            }
            if (ep.cdn) return ep.cdn;
        }
    }

    return '';
}
