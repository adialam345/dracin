import { normalizeFreeShort, type UnifiedDrama } from '../adapter';

const API_BASE = 'https://sapimu.au/freeshort/api/v1';

// Shared tokens from ShortMax/Gateway
const API_TOKENS = [
    '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb',
    'ba3f5eb1a23ef0c00dee764bd05cee7bc6606453deca551185301200cf35b941',
    '8c02960a5aa268ac4ca89b9e86d9d93ea4bb257ed9dc89bc584e3e4aa87c9d8d',
    'b53a335e49b725f092cda317fee26c2707c5eb2f5bc87a60eb1a1367aa6b090e'
];

function getRandomToken() {
    return API_TOKENS[Math.floor(Math.random() * API_TOKENS.length)];
}

const BASE_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

async function fetchWithAuth(url: string) {
    try {
        // Try direct fetch first
        const response = await fetch(url, {
            headers: {
                ...BASE_HEADERS,
                'Authorization': `Bearer ${getRandomToken()}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(5000)
        });
        if (response.ok) return response;
    } catch (e) { }

    return fetch(url, {
        headers: {
            ...BASE_HEADERS,
            'Authorization': `Bearer ${getRandomToken()}`
        }
    });
}

export async function getFreeShortForYou(): Promise<UnifiedDrama[]> {
    try {
        // console.log('[FreeShort] Fetching For You...');
        const response = await fetchWithAuth(`${API_BASE}/foryou?lang=id-ID`);
        if (!response.ok) {
            console.error(`[FreeShort] Error fetching For You: ${response.status}`);
            return [];
        }
        const json = await response.json();
        const list = json.items || json.data || json;

        if (Array.isArray(list)) {
            return list.map((item: any) => normalizeFreeShort({
                ...item,
                id: item.id || item.key,
                title: item.title || item.name || 'Untitled'
            }));
        }
        return [];
    } catch (e) {
        console.error('[FreeShort] Error fetching for you:', e);
        return [];
    }
}

export async function searchFreeShort(query: string): Promise<UnifiedDrama[]> {
    try {
        // console.log(`[FreeShort] Searching: ${query}`);
        const response = await fetchWithAuth(`${API_BASE}/search?q=${encodeURIComponent(query)}&lang=id-ID`);
        if (!response.ok) {
            console.error(`[FreeShort] Error searching: ${response.status}`);
            return [];
        }
        const json = await response.json();
        const list = json.items || json.data || json;

        if (Array.isArray(list)) {
            return list.map((item: any) => normalizeFreeShort({
                ...item,
                id: item.id || item.key,
                title: item.title || item.name || 'Untitled'
            }));
        }
        return [];
    } catch (e) {
        console.error('[FreeShort] Error searching:', e);
        return [];
    }
}

export async function getFreeShortVideoUrl(dramaId: string, episodeNum: number): Promise<string> {
    try {
        // console.log(`[FreeShort] Fetching video URL for ${dramaId} ep ${episodeNum}`);
        const url = `${API_BASE}/dramas/${dramaId}/play/${episodeNum}?lang=id-ID`;
        const response = await fetchWithAuth(url);

        if (!response.ok) {
            console.error(`[FreeShort] Error fetching video: ${response.status}`);
            return '';
        }

        const json = await response.json();
        const data = json.data || json;

        // Check various fields for video URL (FreeShort/DramaWave structure)
        const videoUrl = data.video_url ||
            data.m3u8_url ||
            data.h265_m3u8 ||
            data.h264_m3u8 ||
            data.external_audio_h265_m3u8 ||
            data.url ||
            data.videoUrl ||
            '';

        if (videoUrl && (data.subtitle_list || data.subtitles)) {
            const list = data.subtitle_list || data.subtitles;
            if (Array.isArray(list) && list.length > 0) {
                return JSON.stringify({
                    videoUrl,
                    subtitles: list.map((sub: any) => ({
                        label: sub.display_name || sub.language,
                        lang: sub.language,
                        url: sub.url || sub.subtitle
                    }))
                });
            }
        }

        return videoUrl;
    } catch (e) {
        console.error('[FreeShort] Error getting video:', e);
        return '';
    }
}

export async function getFreeShortDetail(id: string): Promise<{ drama: UnifiedDrama, episodes: any[] } | null> {
    try {
        // console.log(`[FreeShort] Fetching detail for ${id}`);
        // Use dramas/ID endpoint to get full details including episode count/list
        const url = `${API_BASE}/dramas/${id}?lang=id-ID`;
        const response = await fetchWithAuth(url);

        if (!response.ok) {
            console.error(`[FreeShort] Detail fetch error: ${response.status}`);
            return null;
        }

        const json = await response.json();
        const data = json.data || json;

        const dramaInfo = data.drama || data;
        const drama = normalizeFreeShort({
            ...dramaInfo,
            id: id // Ensure ID preserved
        });

        const episodes = [];
        const list = data.episode_list || data.episodes || [];

        if (Array.isArray(list) && list.length > 0) {
            // Map the provided episode list
            list.forEach((ep: any) => {
                const epIndex = ep.index || ep.episode_index || ep.episodeNum;
                episodes.push({
                    id: `${id}_${epIndex}`,
                    name: `Episode ${epIndex}`,
                    index: epIndex - 1,
                    unlock: true, // Assumed free or explicit logic
                    raw: ep
                });
            });
        } else {
            // Fallback generation if no list but total exists
            const total = dramaInfo.episode_count || dramaInfo.total_episodes || dramaInfo.total || 0;
            for (let i = 1; i <= total; i++) {
                episodes.push({
                    id: `${id}_${i}`,
                    name: `Episode ${i}`,
                    index: i - 1,
                    unlock: true,
                    raw: { episodeNum: i }
                });
            }
        }

        return { drama, episodes };
    } catch (e) {
        console.error('[FreeShort] Error getting detail:', e);
        return null;
    }
}
