
import { normalizeHiShort, type UnifiedDrama } from '../adapter';
import { fetchCached } from '../utils';

const API_BASE = 'https://dramabos.asia/api/hishort/api/v1';

async function fetchFromApi(endpoint: string) {
    const url = `${API_BASE}${endpoint}`;
    return fetchCached(url, 3, {
        'Accept': 'application/json',
        'Referer': 'https://dramabos.asia/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
}

export async function getHiShortHome(): Promise<UnifiedDrama[]> {
    const [data1, data2] = await Promise.all([
        fetchFromApi('/modules?tab=4'),
        fetchFromApi('/home?module=12&page=1')
    ]);

    let list: any[] = [];

    [data1, data2].forEach(data => {
        if (!data) return;
        const items = Array.isArray(data) ? data : (data.value || data.data || data.source || []);
        if (Array.isArray(items)) {
            items.forEach((item: any) => {
                if (item.videoInfoList && Array.isArray(item.videoInfoList)) {
                    list = [...list, ...item.videoInfoList];
                } else if (item.vidId) {
                    list.push(item);
                } else if (item.list && Array.isArray(item.list)) {
                    list = [...list, ...item.list];
                }
            });
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
    // 1. Verify existence and get basic status
    const data = await fetchFromApi(`/video/${id}?ep=1`);

    // If not found or error code returned, return null
    if (!data || data.code !== undefined || data.message !== undefined) return null;

    // Check home pages for metadata
    let meta = null;
    const homeResponses = await Promise.all([
        fetchFromApi('/modules?tab=4'),
        fetchFromApi('/home?module=12&page=1')
    ]);

    for (const homeData of homeResponses) {
        if (!homeData) continue;
        const items = Array.isArray(homeData) ? homeData : (homeData.source || homeData.value || homeData.data || []);
        if (Array.isArray(items)) {
            // Flatten if needed (modules?tab=4 returns list of modules)
            for (const item of items) {
                if (item.videoInfoList && Array.isArray(item.videoInfoList)) {
                    meta = item.videoInfoList.find((s: any) => String(s.vidId || s.id) === String(id));
                } else if (String(item.vidId || item.id) === String(id)) {
                    meta = item;
                }
                if (meta) break;
            }
        }
        if (meta) break;
    }

    // If still not found, try search by ID (very reliable for specific IDs)
    if (!meta) {
        const searchResults = await searchHiShort(id);
        if (searchResults && searchResults.length > 0) {
            // Find exact match or take first
            const match = searchResults.find(r => String(r.id) === String(id));
            if (match) return { drama: match, episodes: [] };
        }
    }

    const drama = normalizeHiShort(meta || { vidId: id, totalNum: data.totalNum || 0 });

    // HiShort doesn't have a reliable episode list API, so aggregator will generate it
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

    // Try multiple times if playUrl is missing (some episodes might need a moment or different params)
    const data = await fetchFromApi(`/video/${dramaId}?ep=${ep}`);

    if (!data || !data.playUrl) {
        // Fallback: try without ep param if it's episode 1
        if (ep === 1) {
            const data2 = await fetchFromApi(`/video/${dramaId}`);
            if (data2 && data2.playUrl) return data2.playUrl;
        }
        return '';
    }

    return data.playUrl;
}
