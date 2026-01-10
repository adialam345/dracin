import { normalizeDramaWave, type UnifiedDrama } from '../adapter';
import { fetchCached, withCache } from '../utils';

// API CONSTANTS
const API_BASE = 'https://sapimu.au/dramawave/api/v1';

// Token Rotation (Shared with ShortMax)
const API_TOKENS = [
    '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb', // Original
    'ba3f5eb1a23ef0c00dee764bd05cee7bc6606453deca551185301200cf35b941', // kido345
    '8c02960a5aa268ac4ca89b9e86d9d93ea4bb257ed9dc89bc584e3e4aa87c9d8d', // nxxzzz286919
    'b53a335e49b725f092cda317fee26c2707c5eb2f5bc87a60eb1a1367aa6b090e'  // nexsus72
];

function getRandomToken() {
    return API_TOKENS[Math.floor(Math.random() * API_TOKENS.length)];
}

async function fetchInternal(endpoint: string): Promise<any> {
    const url = `${API_BASE}${endpoint}`;
    return fetchCached(url, 3, {
        'Authorization': `Bearer ${getRandomToken()}`
    });
}

export async function getDramaWaveForYou(): Promise<UnifiedDrama[]> {
    // URL: https://sapimu.au/dramawave/api/v1/feed/popular?lang=in&page=1&lang=id-ID
    const data = await fetchInternal('/feed/popular?lang=in&page=1&lang=id-ID');

    if (!data || !data.data || !Array.isArray(data.data.items)) return [];

    let allItems: any[] = [];

    // The feed returns a list of modules (banner, vertical list, horizontal list, etc.)
    // We need to extract the actual drama items from inside these modules.
    data.data.items.forEach((module: any) => {
        if (module.items && Array.isArray(module.items)) {
            allItems = allItems.concat(module.items);
        } else if (module.list && Array.isArray(module.list)) {
            allItems = allItems.concat(module.list);
        }
    });

    // Remove duplicates based on ID/Key
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
    // URL: https://sapimu.au/dramawave/api/v1/search?lang=in&q=cinta-ID
    const data = await fetchInternal(`/search?lang=in&q=${encodeURIComponent(query)}`);

    if (!data) return [];

    let list = [];
    if (Array.isArray(data)) list = data;
    else if (Array.isArray(data.data)) list = data.data;
    else if (data.data && Array.isArray(data.data.items)) list = data.data.items; // Search items are here
    else if (data.data && Array.isArray(data.data.result_list)) list = data.data.result_list; // Possible variation

    return list.map((item: any) => normalizeDramaWave(item)).filter((i: UnifiedDrama) => i.id);
}

export async function getDramaWaveDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    return withCache(`dw_detail_v2_${id}`, async () => {
        // URL: https://sapimu.au/dramawave/api/v1/dramas/xuyr3DtXPt?lang=in&lang=id-ID
        const data = await fetchInternal(`/dramas/${id}?lang=in&lang=id-ID`);

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
            unlock: true, // Proxied content is unlocked
            raw: ep
        }));

        return { drama: dramaInfo, episodes };
    }, 60 * 60 * 1000);
}
