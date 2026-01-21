
import { normalizeShortTime, type UnifiedDrama } from '../adapter';

const API_BASE = 'https://dramabos.asia/api/shortime';

async function fetchApi(path: string, params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `${API_BASE}${path}?${query}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000) // 10s timeout
        });

        if (!response.ok) {
            console.error(`[ShortTime] API Error ${response.status} for ${url}`);
            return null;
        }

        return await response.json();
    } catch (e) {
        console.error(`[ShortTime] Network Error for ${url}:`, e);
        return null;
    }
}

export async function getShortTimeHome(page: number = 1): Promise<UnifiedDrama[]> {
    const data = await fetchApi('/home', { page: String(page) });

    if (data && data.items && Array.isArray(data.items)) {
        return data.items.map((item: any) => normalizeShortTime(item));
    }

    return [];
}

export async function searchShortTime(query: string, page: number = 1): Promise<UnifiedDrama[]> {
    const data = await fetchApi('/search', { q: query, page: String(page) });
    if (data && data.items && Array.isArray(data.items)) {
        return data.items.map((item: any) => normalizeShortTime(item));
    }
    return [];
}

export async function getShortTimeDetail(id: string): Promise<{ drama: UnifiedDrama, episodes: any[] } | null> {
    const data = await fetchApi(`/detail/${id}`);

    if (!data || !data.ok) return null;

    const drama = normalizeShortTime(data);

    const episodes = (data.episode_list || []).map((ep: any, idx: number) => ({
        id: ep.id?.toString() || String(idx + 1),
        name: ep.title || `Episode ${idx + 1}`,
        index: idx,
        unlock: ep.is_free === true,
        is_teaser: ep.is_teaser,
        raw: ep
    }));

    return { drama, episodes };
}

export async function getShortTimeVideoUrl(episodeId: string): Promise<{ videoUrl: string, cookie?: string, subtitles?: any[] }> {
    // Try /play endpoint first (often contains proxied play_url)
    const data = await fetchApi(`/play/${episodeId}`);

    if (data && data.ok) {
        // Prioritize video_url (direct) because our proxy handles HLS segments better
        // but fallback to play_url if video_url is missing
        let videoUrl = data.video_url || data.play_url || '';
        let cookie = data.cookie || '';

        // Handle case where cookie might be an object or formatted string from /watch
        if (!cookie && data.formatted_header_cookie) {
            cookie = data.formatted_header_cookie;
        }

        return {
            videoUrl,
            cookie,
            subtitles: data.subtitles || []
        };
    }

    // Fallback to /watch endpoint if /play didn't work as expected
    const watchData = await fetchApi(`/watch/${episodeId}`);
    if (watchData && watchData.ok) {
        return {
            videoUrl: watchData.video_url || '',
            cookie: watchData.formatted_header_cookie || '',
            subtitles: watchData.subtitles || []
        };
    }

    return { videoUrl: '' };
}
