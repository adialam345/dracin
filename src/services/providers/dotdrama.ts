import { normalizeDotDrama, type UnifiedDrama } from '../adapter';

// API CONSTANTS
const API_BASE = 'https://dramabos.asia/api/dotdrama/api';

export async function fetchDotDrama(endpoint: string): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    try {
        const response = await fetch(url);
        if (response.ok) {
            return await response.json();
        } else {
            console.error(`[DotDrama] HTTP Error ${response.status} for ${url}`);
        }
    } catch (e) {
        console.error('[DotDrama] Error:', e);
    }
    return null;
}

export async function getDotDramaForYou(): Promise<UnifiedDrama[]> {
    const data = await fetchDotDrama('/drama/list?page=1&limit=20&lang=id');
    return extractList(data);
}

export async function searchDotDrama(query: string): Promise<UnifiedDrama[]> {
    // Placeholder: Need to discover search API.
    // Try a common pattern just in case? Or just return empty.
    console.log(`[DotDrama] Search not available yet.`);
    return [];
}

export async function getDotDramaDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    // Placeholder: Need to discover detail/episode API.
    // For now, returning null/empty will trigger Aggregator's fallback to use cached list info.
    // Synthetic episodes will be generated if chapterCount > 0.
    return { drama: null, episodes: [] };
}

export async function getDotDramaVideoUrl(bookId: string, episodeId: string): Promise<string> {
    // Placeholder: Need to discover video URL API.
    // If the "list" item contained the video (which 'funi' suggests it has ONE video),
    // we could potentially use it if episodeId is '1' or 'trailer'.
    // But without certainty, we return empty string.
    console.warn('[DotDrama] getVideoUrl not implemented (API unknown)');
    return '';
}

function extractList(data: any): UnifiedDrama[] {
    if (!data || !data.dgiv || !Array.isArray(data.dgiv.lint)) return [];

    const items = data.dgiv.lint;
    console.log(`[DotDrama] Extracting list, found ${items.length} items.`);

    return items.map((item: any) => normalizeDotDrama(item)).filter((i: any) => i.id);
}
