import { normalizeStarShort, type UnifiedDrama } from '../adapter';
import { fetchCached } from '../utils';

// API CONSTANTS
const API_BASE = 'https://dramabos.asia/api/starshort/api/v1';

export async function fetchStarShort(endpoint: string): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    try {
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
        // Fallback
    }
    return fetchCached(url);
}

export async function getStarShortForYou(): Promise<UnifiedDrama[]> {
    const data = await fetchStarShort('/home?lang=4');

    if (!data || !data.data) return [];

    let allItems: any[] = [];
    const categories = data.data;

    // Flatten all categories into a single list
    for (const key in categories) {
        if (Array.isArray(categories[key])) {
            allItems = allItems.concat(categories[key]);
        }
    }

    return extractList(allItems);
}

export async function searchStarShort(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchStarShort(`/search?q=${encodeURIComponent(query)}&lang=4`);

    if (!data || !data.data) return [];

    return extractList(data.data);
}

export async function getStarShortDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    // Ensure we use the fakeId if passed only as fakeId, or handle if it's passed as composite
    // The previous implementation stripped suffix. We'll utilize the ID as is, assuming it is the fakeId.
    const cleanId = id.split('_')[0];
    const data = await fetchStarShort(`/drama/${cleanId}?lang=4`);

    if (!data) return { drama: null, episodes: [] };

    // Handle potential wrapper
    const info = data.data || data;

    if (!info) return { drama: null, episodes: [] };

    const dramaInfo = {
        title: info.title || info.name || '',
        cover: info.cover || info.coverImgUrl || '',
        description: info.summary || info.description || info.introduction || '',
        chapterCount: info.episodes || info.episodes_count || info.total_episodes || 0,
        labels: info.tags ? (Array.isArray(info.tags) ? info.tags : [info.tags]) : [],
        viewCount: info.views || 0,
        source: 'starshort'
    };

    let episodes: any[] = [];

    // The new API detail doesn't return an episode list, only the count.
    // We must generate synthetic episodes.
    if (dramaInfo.chapterCount > 0) {
        // console.log(`[StarShort] Generating ${dramaInfo.chapterCount} synthetic episodes for ${cleanId}`);
        episodes = Array.from({ length: dramaInfo.chapterCount }, (_, i) => ({
            id: String(i + 1), // Episode number is used as ID for playback
            name: 'Episode ' + (i + 1),
            index: i,
            unlock: true, // Assuming unlocked for now based on freeUntil logic not being fully clear or just assuming free
            raw: {}
        }));
    } else {
        // console.log(`[StarShort] No episode count found for ${cleanId}. Info keys: ${Object.keys(info).join(', ')}`);
    }

    return { drama: dramaInfo, episodes };
}

export async function getStarShortVideoUrl(bookId: string, episodeId: string): Promise<string> {
    const cleanBookId = bookId.split('_')[0];
    // episodeId here corresponds to the synthetic ID we generated, which is the episode number (1, 2, 3...)

    const url = `/play/${cleanBookId}?ep=${episodeId}&lang=4`;
    const maxRetries = 3;

    for (let i = 0; i < maxRetries; i++) {
        const data = await fetchStarShort(url);

        if (data) {
            const videoData = data.data || data;
            if (videoData.video) return videoData.video;
            if (videoData.video_url) return videoData.video_url;

            // Check for specific error
            if (videoData.error || data.error) {
                console.warn(`[StarShort] Error fetching video: ${videoData.error || data.error}`);
            }
        }

        await new Promise(r => setTimeout(r, 1000));
    }

    console.error(`[StarShort] Failed to get video URL for ${cleanBookId} Ep ${episodeId}`);
    return '';
}

function extractList(items: any[]): UnifiedDrama[] {
    if (!items || !Array.isArray(items)) return [];

    // console.log(`[StarShort] Extracting list, found ${items.length} items.`);

    return items.map(item => normalizeStarShort(item)).filter(i => {
        // if (!i.id) console.log('[StarShort] Item dropped due to missing ID:', JSON.stringify(i));
        return i.id;
    });
}
