
import { normalizeHiShort, type UnifiedDrama } from '../adapter';

const API_BASE = 'https://dramabos.asia/api/hishort/api/v1';

async function fetchFromApi(endpoint: string) {
    const url = `${API_BASE}${endpoint}`;
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Referer': 'https://dramabos.asia/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            console.error(`[HiShort] API Error ${response.status} for ${url}`);
            return null;
        }
        return await response.json();
    } catch (e: any) {
        console.error(`[HiShort] Fetch error for ${url}:`, e.message || e);
        return null;
    }
}

export async function getHiShortHome(): Promise<UnifiedDrama[]> {
    const data = await fetchFromApi('/modules?tab=4');

    if (!data) return [];

    // Handle both array response and wrapped response (just in case)
    const modules = Array.isArray(data) ? data : (data.value || data.data || []);

    if (!Array.isArray(modules)) return [];

    let list: any[] = [];
    modules.forEach((module: any) => {
        if (module.videoInfoList && Array.isArray(module.videoInfoList)) {
            list = [...list, ...module.videoInfoList];
        } else if (module.list && Array.isArray(module.list)) {
            list = [...list, ...module.list];
        }
    });

    // Filter duplicates based on vidId
    const seen = new Set();
    const uniqueList = list.filter(item => {
        const id = item.vidId || item.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    return uniqueList.map(normalizeHiShort);
}

export async function searchHiShort(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchFromApi(`/search?q=${encodeURIComponent(query)}`);

    if (!data || !data.source || !Array.isArray(data.source)) return [];

    return data.source.map(normalizeHiShort);
}

export async function getHiShortDetail(id: string): Promise<{ drama: UnifiedDrama, episodes: any[] } | null> {
    // We try to fetch the first episode to verify it exists
    const data = await fetchFromApi(`/video/${id}?ep=1`);

    if (!data || !data.playUrl) return null;

    // Use placeholder drama object (aggregator will likely override from cache)
    const drama = normalizeHiShort({ vidId: id });

    // We don't have an episodes list API, so we return empty and let aggregator generate it from chapterCount
    return { drama, episodes: [] };
}

export async function getHiShortVideoUrl(episodeId: string): Promise<string> {
    // Expecting format "dramaId_episodeNum"
    let dramaId = episodeId;
    let ep = 1;

    if (episodeId.includes('_')) {
        const parts = episodeId.split('_');
        dramaId = parts[0];
        ep = parseInt(parts[1]) || 1;
    } else if (episodeId.includes('-')) {
        const parts = episodeId.split('-');
        dramaId = parts[0];
        ep = parseInt(parts[1]) || 1;
    }

    const data = await fetchFromApi(`/video/${dramaId}?ep=${ep}`);

    if (!data || !data.playUrl) return '';

    return data.playUrl;
}
