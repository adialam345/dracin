import { normalizeDramaWave, type UnifiedDrama } from '../adapter';
import { fetchCached, withCache } from '../utils';

// API CONSTANTS
const API_BASE = 'https://dramabos.asia/api/dramawave/api/v1';

async function fetchInternal(endpoint: string): Promise<any> {
    const url = `${API_BASE}${endpoint}`;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(5000)
        });
        if (response.ok) return await response.json();
    } catch (e) { }

    return fetchCached(url, 3, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
}

export async function getDramaWaveForYou(): Promise<UnifiedDrama[]> {
    // Gunakan feed/free sesuai instruksi user
    const data = await fetchInternal('/feed/free?lang=id');

    if (!data || !data.data || !Array.isArray(data.data.items)) return [];

    let allItems: any[] = [];

    data.data.items.forEach((module: any) => {
        if (module.items && Array.isArray(module.items)) {
            allItems = allItems.concat(module.items);
        } else if (module.list && Array.isArray(module.list)) {
            allItems = allItems.concat(module.list);
        }
    });

    const uniqueItems = new Map();
    allItems.forEach(item => {
        const id = item.key || item.id;
        if (id && !uniqueItems.has(id)) {
            uniqueItems.set(id, item);
        }
    });

    return Array.from(uniqueItems.values())
        .map((item: any) => normalizeDramaWave(item))
        .filter((i: UnifiedDrama) => i.id);
}

export async function getDramaWaveTrending(): Promise<UnifiedDrama[]> {
    // Gunakan feed/popular sesuai instruksi user
    const data = await fetchInternal('/feed/popular?lang=id');

    if (!data || !data.data || !Array.isArray(data.data.items)) return [];

    let allItems: any[] = [];

    data.data.items.forEach((module: any) => {
        if (module.items && Array.isArray(module.items)) {
            allItems = allItems.concat(module.items);
        } else if (module.list && Array.isArray(module.list)) {
            allItems = allItems.concat(module.list);
        }
    });

    const uniqueItems = new Map();
    allItems.forEach(item => {
        const id = item.key || item.id;
        if (id && !uniqueItems.has(id)) {
            uniqueItems.set(id, item);
        }
    });

    return Array.from(uniqueItems.values())
        .map((item: any) => normalizeDramaWave(item))
        .filter((i: UnifiedDrama) => i.id);
}

export async function searchDramaWave(query: string): Promise<UnifiedDrama[]> {
    // Format: /search?q=love&lang=id&page=1
    const data = await fetchInternal(`/search?q=${encodeURIComponent(query)}&lang=id&page=1`);

    if (!data) return [];

    let list = [];
    if (Array.isArray(data)) list = data;
    else if (Array.isArray(data.data)) list = data.data;
    else if (data.data && Array.isArray(data.data.items)) list = data.data.items;
    else if (data.data && Array.isArray(data.data.result_list)) list = data.data.result_list;

    return list.map((item: any) => normalizeDramaWave(item)).filter((i: UnifiedDrama) => i.id);
}

export async function getDramaWaveDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    return withCache(`dw_detail_v3_${id}`, async () => {
        // Format: /dramas/ID?lang=id
        const data = await fetchInternal(`/dramas/${id}?lang=id`);

        if (!data || !data.data) {
            return { drama: null, episodes: [] };
        }
        const info = data.data.info || (data.data.id || data.data.name ? data.data : null);

        if (!info || (!info.id && !info.name && !info.title)) {
            return { drama: null, episodes: [] };
        }

        const dramaInfo = {
            title: info.name || info.title,
            cover: info.cover,
            description: info.desc || info.introduction || info.summary,
            chapterCount: info.episode_count || (info.episode_list && info.episode_list.length) || 0,
            labels: info.tags || info.series_tag || [],
            source: 'dramawave'
        };

        const rawEpisodes = info.episode_list || info.episodes || [];
        const episodes = rawEpisodes.map((ep: any, index: number) => ({
            id: ep.id,
            name: ep.name || `Episode ${index + 1}`,
            index: index,
            unlock: true,
            raw: ep
        }));

        return { drama: dramaInfo, episodes };
    }, 60 * 60 * 1000);
}

/**
 * Get Video URL for DramaWave
 */
export async function getDramaWaveVideoUrl(dramaId: string, episodeNum: number): Promise<string> {
    try {
        // Format: /dramas/ID/play/EP?lang=id
        const url = `/dramas/${dramaId}/play/${episodeNum}?lang=id`;
        const data = await fetchInternal(url);

        if (data && data.data && data.data.video) {
            const v = data.data.video;
            return v.h264_m3u8 || v.h265_m3u8 || v.video_url || v.url || '';
        }
    } catch (e) {
        console.error('[DramaWave] Error fetching video URL:', e);
    }
    return '';
}
