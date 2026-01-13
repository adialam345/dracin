import { normalizeReelLife, type UnifiedDrama } from '../adapter';
import { fetchCached } from '../utils';

const REELLIFE_HOME_API = 'https://apikupas.my.id/reelife/home?_t=1767904804553';

async function fetchReelLife(url: string): Promise<any> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(5000)
        });
        if (response.ok) return await response.json();
    } catch (e) { }
    return fetchCached(url);
}

/**
 * Get ReelLife Homepage / For You
 */
export async function getReelLifeTrending(): Promise<UnifiedDrama[]> {
    try {
        const json = await fetchReelLife('https://dramabos.asia/api/reelife/v1/rank');
        if (!json || !json.ranks) return [];

        let allPrograms: any[] = [];
        json.ranks.forEach((rank: any) => {
            if (rank.programs && Array.isArray(rank.programs)) {
                allPrograms.push(...rank.programs);
            }
        });

        const unique = new Map();
        for (const item of allPrograms) {
            if (item.id && !unique.has(item.id)) {
                unique.set(item.id, item);
            }
        }

        return Array.from(unique.values()).map(normalizeReelLife);
    } catch (e) {
        return [];
    }
}

export async function getReelLifeForYou(): Promise<UnifiedDrama[]> {
    try {
        const json = await fetchReelLife(REELLIFE_HOME_API);

        // Combine slider and latest if available
        let list: any[] = [];
        if (json.slider && Array.isArray(json.slider)) {
            list = list.concat(json.slider);
        }
        if (json.latest && Array.isArray(json.latest)) {
            list = list.concat(json.latest);
        }

        // Deduplicate by ID
        const unique = new Map();
        for (const item of list) {
            if (item.id && !unique.has(item.id)) {
                unique.set(item.id, item);
            }
        }

        const results = Array.from(unique.values()).map(normalizeReelLife);
        return results;
    } catch (e) {
        console.error('[ReelLife] Home exception:', e);
        return [];
    }
}

const REELLIFE_SEARCH_API = 'https://apikupas.my.id/reelife/search';

/**
 * Search Drama
 */
export async function searchReelLife(query: string): Promise<UnifiedDrama[]> {
    try {
        // console.log(`[ReelLife] Searching: ${query}`);
        const url = `${REELLIFE_SEARCH_API}/${encodeURIComponent(query)}?_t=${Date.now()}`;
        const json = await fetchReelLife(url);

        if (!json || !Array.isArray(json)) return [];

        // Deduplicate by ID
        const unique = new Map();
        for (const item of json) {
            if (item.id && !unique.has(item.id)) {
                unique.set(item.id, item);
            }
        }

        return Array.from(unique.values()).map(normalizeReelLife);
    } catch (e) {
        console.error('[ReelLife] Search exception:', e);
        return [];
    }
}

const REELLIFE_DETAIL_API = 'https://apikupas.my.id/reelife/anime';

/**
 * Get Detail
 */
export async function getReelLifeDetail(id: string): Promise<{ drama: any, episodes: any[] } | null> {
    try {
        // console.log(`[ReelLife] Fetching detail: ${id}`);
        // Endpoint: https://apikupas.my.id/reelife/anime/{id}
        const url = `${REELLIFE_DETAIL_API}/${id}?_t=${Date.now()}`;
        const json = await fetchReelLife(url);

        if (!json || !json.id) return null;

        const drama = {
            id: String(json.id),
            title: json.title,
            cover: json.poster || json.cover,
            description: json.description || json.synopsis || '',
            chapterCount: json.totalEpisodes || (json.episodes ? json.episodes.length : 0),
            labels: json.status ? [json.status] : [],
            source: 'reelife'
        };

        const episodes = (json.episodes || []).map((ep: any) => ({
            id: String(ep.number), // Use number as ID for consistency
            name: `Episode ${ep.number}`,
            index: ep.number - 1,
            unlock: true, // Optimistic unlock
            raw: ep
        }));

        return { drama, episodes };
    } catch (e) {
        console.error('[ReelLife] Detail exception:', e);
        return null;
    }
}

const REELLIFE_EPISODE_API = 'https://apikupas.my.id/reelife/episode';

/**
 * Get Video URL
 */
export async function getReelLifeVideoUrl(id: string, episodeNum: number): Promise<string> {
    try {
        // console.log(`[ReelLife] Fetching video for ID: ${id}, Ep: ${episodeNum}`);
        // Endpoint: https://apikupas.my.id/reelife/episode/{id}-{episodeNum}
        // Note: The ID passed here is usually the BookID. The API expects bookId-episodeNum
        const url = `${REELLIFE_EPISODE_API}/${id}-${episodeNum}?_t=${Date.now()}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[ReelLife] Video error: ${response.status}`);
            return '';
        }

        const json = await response.json();

        if (json.servers && Array.isArray(json.servers) && json.servers.length > 0) {
            // Prioritize higher quality or HLS if needed, but here simple logic
            return json.servers[0].url || '';
        }

        return '';
    } catch (e) {
        console.error('[ReelLife] Video exception:', e);
        return '';
    }
}
