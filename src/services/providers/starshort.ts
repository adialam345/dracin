import { normalizeStarShort, type UnifiedDrama } from '../adapter';

// API CONSTANTS
const API_BASE = 'https://sapimu.au/starshort/api/v1';

// Token Rotation (Shared with DramaWave)
const API_TOKENS = [
    '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb', // Original
    'ba3f5eb1a23ef0c00dee764bd05cee7bc6606453deca551185301200cf35b941', // kido345
    '8c02960a5aa268ac4ca89b9e86d9d93ea4bb257ed9dc89bc584e3e4aa87c9d8d', // nxxzzz286919
    'b53a335e49b725f092cda317fee26c2707c5eb2f5bc87a60eb1a1367aa6b090e'  // nexsus72
];

function getRandomToken() {
    return API_TOKENS[Math.floor(Math.random() * API_TOKENS.length)];
}

export async function fetchStarShort(endpoint: string): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const token = getRandomToken();

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error(`[fetchStarShort] HTTP Error ${response.status} for ${url}`);
            const text = await response.text();
            console.error(`[fetchStarShort] Response body: ${text}`);
        }
    } catch (e) {
        console.error('[fetchStarShort] Error:', e);
    }
    return null;
}

export async function getStarShortForYou(): Promise<UnifiedDrama[]> {
    const data = await fetchStarShort('/dramas?lang=4');
    return extractList(data);
}

export async function searchStarShort(query: string): Promise<UnifiedDrama[]> {
    const url = `https://cdp.starshort.online/cdp/server_api/compilations/search_detail/v2?keyword=${encodeURIComponent(query)}&pageNumber=1&pageSize=20`;
    console.log(`[StarShort] Searching (Direct): ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'Host': 'cdp.starshort.online',
                'language': '4',
                'user-token': 'N4gAYsSN7cNoqVsbIg92YYrZQ8jPjgrNrHa7Q+61ITNc2wgryful8ZYNBtXFoVKZ4bqo2BesFhMfY6UJj3iaff8MH4PR3tKHNBnB/CbNGVHZKmgdY1fJoR/cHFb6zdzDHl3MtocR7H2qAXfy0BCanw4xmRD1JWJ/Dj7d/sq1osW9Ce+CJyTVIIM5otNhRVoFFj9yCvAEIBdh6vkr1pmXWZ49RzMlBEnC+xUu5orIj4YjkUq+nVeiEoi+gW0SFuRNeWM1IpE6OHo+WYXorcIvi+CDtHB5DWyXIV+j5viN3vEG75J1LgHWMsu61UnY4jj7Ro+oD2p7BuiDsM3T2hFoRg==',
                'version-str': '2.35.0',
                'pay-version': 'V2',
                'country': 'ID',
                'User-Agent': 'StarShort/2.35.0 (com.rlkj.lang.movie; build:2025123104; iOS 17.0.3) Alamofire/5.10.2',
                'client-all-id': '{"idfa":"","idfv":"71600CD9-C27B-4473-8DDC-DE960F28996F"}',
                'device-id': '71600CD9-C27B-4473-8DDC-DE960F28996F',
                'c-type': '3',
                'client-id': '1052'
            }
        });

        if (response.ok) {
            const data = await response.json();
            // console.log(`[StarShort] Search response keys:`, data ? Object.keys(data).join(',') : 'null');
            return extractList(data);
        } else {
            console.error(`[StarShort] Search HTTP Error ${response.status}`);
            return [];
        }
    } catch (e) {
        console.error('[StarShort] Search Error:', e);
        return [];
    }
}

export async function getStarShortDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    // Safety: Strip suffix if present (e.g. 1jG2_5080 -> 1jG2)
    const cleanId = id.split('_')[0];
    const data = await fetchStarShort(`/dramas/${cleanId}?lang=4`);

    if (!data) return { drama: null, episodes: [] };

    // Handle potential wrapper
    const info = data.data || data;

    if (!info) return { drama: null, episodes: [] };

    const dramaInfo = {
        title: info.title || info.name || '',
        cover: info.cover || info.coverImgUrl || '',
        description: info.description || info.introduction || '',
        chapterCount: info.episodes_count || info.total_episodes || (info.episodes ? info.episodes.length : 0),
        labels: info.tags ? (Array.isArray(info.tags) ? info.tags : [info.tags]) : [],
        viewCount: info.views || 0,
        source: 'starshort'
    };

    let episodes: any[] = [];
    const rawEpisodes = info.episodes || info.episode_list || [];

    if (Array.isArray(rawEpisodes) && rawEpisodes.length > 0) {
        episodes = rawEpisodes.map((ep: any, index: number) => ({
            id: ep.id || String(index + 1),
            name: ep.title || 'Episode ' + (index + 1),
            index: index,
            unlock: true,
            raw: ep
        }));
    } else if (dramaInfo.chapterCount > 0) {
        console.log(`[StarShort] Generating ${dramaInfo.chapterCount} synthetic episodes for ${cleanId}`);
        // Synthetic generation for sequential IDs (1, 2, 3...)
        episodes = Array.from({ length: dramaInfo.chapterCount }, (_, i) => ({
            id: String(i + 1),
            name: 'Episode ' + (i + 1),
            index: i,
            unlock: true,
            raw: {}
        }));
    } else {
        console.log(`[StarShort] No episodes found for ${cleanId}. Info keys: ${Object.keys(info).join(', ')}`);
    }

    // Ensure we update chapterCount if we found episodes (source of truth)
    if (episodes.length > 0) {
        dramaInfo.chapterCount = episodes.length;
    }

    return { drama: dramaInfo, episodes };
}

export async function getStarShortVideoUrl(bookId: string, episodeId: string): Promise<string> {
    // Safety: Strip suffix if present
    const cleanBookId = bookId.split('_')[0];
    const url = `/dramas/${cleanBookId}/episodes/${episodeId}?lang=4`;
    const maxRetries = 15; // Aggressive retries as per user request

    for (let i = 0; i < maxRetries; i++) {
        // Log only on first attempt or every 5th to avoid spam, unless it's an error
        if (i === 0 || i % 5 === 0) console.log(`[StarShort] Fetching video URL (Attempt ${i + 1}/${maxRetries}): ${url}`);

        const data = await fetchStarShort(url);

        if (data) {
            // Check for explicit error to retry
            if (data.error === "User is not logged in") {
                console.warn(`[StarShort] Attempt ${i + 1} failed: "User is not logged in". Retrying...`);
                await new Promise(r => setTimeout(r, 800)); // Wait 800ms before retry
                continue;
            }

            // direct snake_case (seen in user logs)
            if (data.video_url) return data.video_url;

            // direct camelCase
            if (data.videoUrl) return data.videoUrl;
            if (data.url) return data.url;

            // Wrapped in data object
            if (data.data) {
                if (typeof data.data === 'string') return data.data;
                if (data.data.video_url) return data.data.video_url;
                if (data.data.videoUrl) return data.data.videoUrl;
                if (data.data.url) return data.data.url;
            }

            // Log unexpected successful response structure
            console.log(`[StarShort] Attempt ${i + 1} returned data but no video URL found:`, JSON.stringify(data));
        } else {
            // Network error or other HTTP error (null result)
            console.warn(`[StarShort] Attempt ${i + 1} failed (Network/Auth). Retrying...`);
        }

        // Wait before next retry (shorter delay for network flakes)
        await new Promise(r => setTimeout(r, 1000));
    }

    console.error(`[StarShort] Failed to get video URL after ${maxRetries} attempts.`);
    return '';
}

function extractList(data: any): UnifiedDrama[] {
    if (!data) return [];
    let items: any[] = [];

    if (Array.isArray(data)) items = data;
    else if (data.data && Array.isArray(data.data)) items = data.data;

    console.log(`[StarShort] Extracting list, found ${items.length} items. First item:`, items[0] ? JSON.stringify(items[0]) : 'None');

    return items.map(item => normalizeStarShort(item)).filter(i => {
        if (!i.id) console.log('[StarShort] Item dropped due to missing ID:', JSON.stringify(i));
        return i.id;
    });
}
