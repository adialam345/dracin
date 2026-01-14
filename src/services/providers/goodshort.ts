
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
    // 1. Fetch basic info from /book/{id}
    const bookRes = await fetchApi(`/book/${id}`);
    const bookInfo = bookRes?.data?.book;

    if (!bookInfo) return null;

    const drama = normalizeGoodShort(bookInfo);

    // 2. Fetch full episode list from /chapters/{id}
    const chaptersRes = await fetchApi(`/chapters/${id}`);
    let chapters = chaptersRes?.data?.list || chaptersRes?.data || [];

    // Fallback to bookRes's 3 items if /chapters fails
    if (!Array.isArray(chapters) || chapters.length === 0) {
        chapters = bookRes?.data?.list || [];
    }

    const episodes = chapters.map((ch: any, idx: number) => ({
        id: ch.id?.toString(),
        name: ch.chapterName || `Episode ${idx + 1}`,
        index: idx,
        unlock: ch.price === 0,
        raw: ch
    }));

    return { drama, episodes };
}

export async function getGoodShortVideoUrl(bookId: string, episodeId: string): Promise<string> {
    const data = await fetchApi(`/play/${episodeId}`, { bookId });

    if (data && data.data && data.data.multiVideos) {
        const videos = data.data.multiVideos;
        // Prefer 720p or 1080p if available
        const video = videos.find((v: any) => v.type === '720p') || videos.find((v: any) => v.type === '1080p') || videos[0];
        if (video && video.filePath) {
            return video.filePath;
        }
    }

    return '';
}
