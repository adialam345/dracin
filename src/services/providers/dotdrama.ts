import { normalizeDotDrama, type UnifiedDrama } from '../adapter';
import { fetchCached } from '../utils';

// API CONSTANTS
const API_BASE = 'https://dramabos.asia/api/dotdrama/api';

export async function fetchDotDrama(endpoint: string): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    try {
        // Try direct fetch first (user confirmed API works)
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        // console.log(`[DotDrama] Direct fetch failed, trying proxy...`);
    }

    return fetchCached(url);
}

export async function getDotDramaForYou(): Promise<UnifiedDrama[]> {
    const data = await fetchDotDrama('/drama/list?page=1&limit=20&lang=id');
    return extractList(data);
}

export async function searchDotDrama(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchDotDrama(`/search?q=${encodeURIComponent(query)}&lang=id`);

    if (!data || !Array.isArray(data.results)) {
        // console.log(`[DotDrama] Search returned no results structure.`);
        return [];
    }

    const items = data.results;
    // console.log(`[DotDrama] Search found ${items.length} items.`);

    return items.map((item: any) => normalizeDotDrama(item)).filter((i: any) => i.id);
}

// In-memory cache for episode data to avoid re-fetching detail API for every video
const episodeCache = new Map<string, any[]>();

export async function getDotDramaDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    try {
        const data = await fetchDotDrama(`/drama/${id}`);

        if (!data || !data.dgiv || !data.dgiv.bswitc) {
            return { drama: null, episodes: [] };
        }

        const info = data.dgiv.bswitc;
        const drama = normalizeDotDrama(info);

        let episodes: any[] = [];
        const rawEpisodes = data.dgiv.ebeer || [];

        if (Array.isArray(rawEpisodes) && rawEpisodes.length > 0) {
            // Cache for video URL lookup
            episodeCache.set(id, rawEpisodes);

            episodes = rawEpisodes.map((ep: any) => ({
                id: String(ep.ewheel), // Use 'ewheel' (1, 2, 3) as the episode ID
                name: `Episode ${ep.ewheel}`,
                index: (ep.ewheel || 1) - 1,
                unlock: true, // It seems all links are exposed?
                raw: ep
            }));
        } else if ((drama.chapterCount || 0) > 0) {
            // Synthetic fallback if ebeer is empty (unlikely given analysis)
            episodes = Array.from({ length: drama.chapterCount || 0 }, (_, i) => ({
                id: String(i + 1),
                name: `Episode ${i + 1}`,
                index: i,
                unlock: true
            }));
        }

        return { drama, episodes };
    } catch (error) {
        console.error('[DotDrama] Error fetching detail:', error);
        return { drama: null, episodes: [] };
    }
}

export async function getDotDramaVideoUrl(bookId: string, episodeId: string): Promise<string> {
    let episodes = episodeCache.get(bookId);

    // If cache miss, re-fetch detail
    if (!episodes) {
        // console.log(`[DotDrama] Cache miss for ${bookId}, fetching detail...`);
        const data = await fetchDotDrama(`/drama/${bookId}`);
        if (data && data.dgiv && Array.isArray(data.dgiv.ebeer)) {
            episodes = data.dgiv.ebeer;
            episodeCache.set(bookId, episodes!);
        }
    }

    if (!episodes) return '';

    // Find the episode
    const ep = episodes.find((e: any) => String(e.ewheel) === String(episodeId));

    if (ep && ep.pphys && Array.isArray(ep.pphys)) {
        // Prefer 720P, then 540P, then whatever
        const v720 = ep.pphys.find((v: any) => v.Dbag === '720P');
        const v540 = ep.pphys.find((v: any) => v.Dbag === '540P');
        const v480 = ep.pphys.find((v: any) => v.Dbag === '480P');
        const anyV = ep.pphys[0];

        const target = v720 || v540 || v480 || anyV;
        return target ? target.Mopp : '';
    }

    return '';
}

function extractList(data: any): UnifiedDrama[] {
    if (!data || !data.dgiv || !Array.isArray(data.dgiv.lint)) return [];

    const items = data.dgiv.lint;
    // console.log(`[DotDrama] Extracting list, found ${items.length} items.`);

    return items.map((item: any) => normalizeDotDrama(item)).filter((i: any) => i.id);
}
