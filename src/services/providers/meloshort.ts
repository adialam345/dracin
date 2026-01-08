
import { normalizeMeloshort, type UnifiedDrama } from '../adapter';

const MELOSHORT_HOME_API = 'https://apikupas.my.id/meloshort/home?_t=1767910096749';
const MELOSHORT_SEARCH_API = 'https://apikupas.my.id/meloshort/search';
const MELOSHORT_DETAIL_API = 'https://apikupas.my.id/meloshort/anime'; // Guessing based on ReelLife
const MELOSHORT_EPISODE_API = 'https://apikupas.my.id/meloshort/episode'; // Guessing based on ReelLife

/**
 * Get Meloshort Homepage / For You
 */
export async function getMeloshortForYou(): Promise<UnifiedDrama[]> {
    try {
        console.log('[Meloshort] Fetching home...');
        const response = await fetch(MELOSHORT_HOME_API);

        if (!response.ok) {
            console.error(`[Meloshort] Home error: ${response.status}`);
            return [];
        }

        const json = await response.json();

        // Combine spotlight and latest if available
        let list: any[] = [];
        if (json.spotlight && Array.isArray(json.spotlight)) {
            list = list.concat(json.spotlight);
        }
        if (json.latest && Array.isArray(json.latest)) {
            list = list.concat(json.latest);
        }

        // Deduplicate by ID
        const unique = new Map();
        for (const item of list) {
            const id = item.slug || item.id;
            if (id && !unique.has(id)) {
                unique.set(id, item);
            }
        }

        const results = Array.from(unique.values()).map(normalizeMeloshort);
        return results;
    } catch (e) {
        console.error('[Meloshort] Home exception:', e);
        return [];
    }
}

/**
 * Search Drama
 */
export async function searchMeloshort(query: string): Promise<UnifiedDrama[]> {
    try {
        console.log(`[Meloshort] Searching: ${query}`);
        // Endpoint: https://apikupas.my.id/meloshort/search/{query}
        const url = `${MELOSHORT_SEARCH_API}/${encodeURIComponent(query)}?_t=${Date.now()}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[Meloshort] Search error: ${response.status}`);
            return [];
        }

        const json = await response.json();

        if (!json || !Array.isArray(json)) return [];

        // Deduplicate by ID
        const unique = new Map();
        for (const item of json) {
            const id = item.slug || item.id;
            if (id && !unique.has(id)) {
                unique.set(id, item);
            }
        }

        return Array.from(unique.values()).map(normalizeMeloshort);
    } catch (e) {
        console.error('[Meloshort] Search exception:', e);
        return [];
    }
}

/**
 * Get Detail
 */
export async function getMeloshortDetail(id: string): Promise<{ drama: any, episodes: any[] } | null> {
    try {
        console.log(`[Meloshort] Fetching detail: ${id}`);
        // Endpoint: https://apikupas.my.id/meloshort/anime/{id}
        const url = `${MELOSHORT_DETAIL_API}/${id}?_t=${Date.now()}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[Meloshort] Detail error: ${response.status}`);
            return null;
        }

        const json = await response.json();

        // Response format: { title, poster, synopsis, status, episodes: [...] }
        if (!json || (!json.title && !json.episodes)) return null;

        // Poster handling similar to normalizeMeloshort
        let cover = json.poster || json.cover || '';
        if (cover.startsWith('/img?url=')) {
            cover = 'https://apikupas.my.id' + cover;
        }

        const drama = {
            id: id, // The ID passed in is the slug/ID used for fetching
            title: json.title,
            cover: cover,
            description: json.description || json.synopsis || '',
            chapterCount: json.totalEpisodes || (json.episodes ? json.episodes.length : 0),
            labels: json.status ? [json.status] : [],
            source: 'meloshort'
        };

        const episodes = (json.episodes || []).map((ep: any) => ({
            id: ep.slug, // Use slug as ID because play API needs it
            name: `Episode ${ep.number}`,
            index: ep.number - 1,
            unlock: true, // Optimistic unlock
            raw: ep
        }));

        return { drama, episodes };
    } catch (e) {
        console.error('[Meloshort] Detail exception:', e);
        return null; // Return null effectively implies fallback or error
    }
}

/**
 * Get Video URL
 */
export async function getMeloshortVideoUrl(id: string, episodeNum: number): Promise<string> {
    try {
        console.log(`[Meloshort] Fetching video for Slug: ${id}`);
        // Endpoint: https://apikupas.my.id/meloshort/episode/{slug}
        // Note: The 'id' passed here is the episode slug we mapped in Detail
        const url = `${MELOSHORT_EPISODE_API}/${encodeURIComponent(id)}?_t=${Date.now()}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[Meloshort] Video error: ${response.status}`);
            return '';
        }

        const json = await response.json();

        if (json.servers && Array.isArray(json.servers) && json.servers.length > 0) {
            return json.servers[0].url || '';
        }

        return '';
    } catch (e) {
        console.error('[Meloshort] Video exception:', e);
        return '';
    }
}
