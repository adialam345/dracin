import { normalizeStarDustTV, type UnifiedDrama } from '../adapter';

// API CONSTANTS
const API_BASE = 'https://dramabos.asia/api/stardusttv';

export async function fetchStardustTV(endpoint: string): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    try {
        const response = await fetch(url);
        if (response.ok) {
            return await response.json();
        } else {
            console.error(`[StardustTV] HTTP Error ${response.status} for ${url}`);
        }
    } catch (e) {
        console.error('[StardustTV] Error:', e);
    }
    return null;
}

export async function getStardustTVForYou(): Promise<UnifiedDrama[]> {
    const data = await fetchStardustTV('/home');
    if (!data || !data.data) return [];

    let items: any[] = [];
    if (data.data.trending) items = items.concat(data.data.trending);
    if (data.data.terpopuler) items = items.concat(data.data.terpopuler);
    if (data.data.series_baru) items = items.concat(data.data.series_baru);

    // Filter duplicates
    const seen = new Set();
    const uniqueItems = items.filter(i => {
        const k = i.vid;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });

    // console.log(`[StardustTV] Found ${items.length} raw, ${uniqueItems.length} unique items.`);
    return uniqueItems.map(normalizeStarDustTV);
}

const episodeCache = new Map<string, any[]>();

export async function getStardustTVDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    const data = await fetchStardustTV(`/episodes/${id}`);

    if (!data || !data.data || !data.data.video_info) {
        return { drama: null, episodes: [] };
    }

    const info = data.data.video_info;

    // Normalize detail data to UnifiedDrama format
    // Normalize detail data to UnifiedDrama format
    const drama = normalizeStarDustTV({
        vid: info.id || info.vid || id,
        title: info.english_name || info.name,
        image: info.cover_path || info.cover_snapshot_path,
        description: info.intro,
        ...info
    });
    drama.chapterCount = info.episode_total || (data.data.list ? data.data.list.length : 0);

    let episodes: any[] = [];
    if (Array.isArray(data.data.list)) {
        // Cache for video lookup
        const rawEpisodes = data.data.list;
        episodeCache.set(id, rawEpisodes);

        episodes = rawEpisodes.map((ep: any) => ({
            id: String(ep.sort), // Use sort order as ID (1, 2, 3)
            name: ep.name || `Episode ${ep.sort}`,
            index: (ep.sort || 1) - 1,
            unlock: true, // Seems all exposed based on response? Or maybe is_vip check needed.
            raw: ep
        }));
    }

    return { drama, episodes };
}

export async function searchStardustTV(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchStardustTV(`/search?q=${encodeURIComponent(query)}`);
    if (!data || !data.data || !Array.isArray(data.data.data)) return [];

    return data.data.data.map((item: any) => normalizeStarDustTV({
        vid: item.id,
        title: item.english_name || item.name,
        image: item.cover_path || item.cover_snapshot_path || item.alioss_cover,
        description: item.intro,
        // search results usually don't have episode details, so 0 is fine
        chapterCount: item.episode_total || 0
    }));
}

export async function getStardustTVVideoUrl(bookId: string, episodeId: string): Promise<string> {
    let episodes = episodeCache.get(bookId);

    // If cache miss, re-fetch detail
    if (!episodes) {
        const data = await fetchStardustTV(`/episodes/${bookId}`);
        if (data && data.data && Array.isArray(data.data.list)) {
            episodes = data.data.list;
            episodeCache.set(bookId, episodes!);
        }
    }

    if (!episodes) return '';

    // Find the episode by sort number
    const ep = episodes.find((e: any) => String(e.sort) === String(episodeId));

    if (ep) {
        // Prefer auto_filepath (h265?) or filepath (h264)
        return ep.filepath || ep.auto_filepath || '';
    }

    return '';
}
