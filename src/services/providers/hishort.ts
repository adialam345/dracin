
import { normalizeHiShort, type UnifiedDrama } from '../adapter';

const API_BASE = 'https://sapimu.au/hishort/api';

// Pool of tokens (shared with ShortMax/Sapimu)
const API_TOKENS = [
    '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb', // Original
    'ba3f5eb1a23ef0c00dee764bd05cee7bc6606453deca551185301200cf35b941', // kido345
    '8c02960a5aa268ac4ca89b9e86d9d93ea4bb257ed9dc89bc584e3e4aa87c9d8d', // nxxzzz286919
    'b53a335e49b725f092cda317fee26c2707c5eb2f5bc87a60eb1a1367aa6b090e'  // nexsus72
];

function getRandomToken() {
    return API_TOKENS[Math.floor(Math.random() * API_TOKENS.length)];
}

async function fetchFromApi(endpoint: string) {
    try {
        console.log(`[HiShort] Fetching: ${endpoint}`);
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${getRandomToken()}`,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`[HiShort] API error: ${response.status} for ${endpoint}`);
            return null;
        }

        return await response.json();
    } catch (e) {
        console.error(`[HiShort] Network error:`, e);
        return null;
    }
}

export async function getHiShortHome(): Promise<UnifiedDrama[]> {
    const data = await fetchFromApi('/home?lang=in');

    // API returns object with keys like "popular" associated with arrays
    if (!data) return [];

    // Structure: { popular: [...], new: [...], ... }
    // We prioritize 'popular' but can aggregate if needed.
    let list: any[] = [];

    if (data.popular && Array.isArray(data.popular)) {
        list = [...list, ...data.popular];
    }

    if (data.new && Array.isArray(data.new)) {
        list = [...list, ...data.new];
    }

    // Fallback: If specific keys missing, try to find any array in the object
    if (list.length === 0) {
        Object.values(data).forEach((val: any) => {
            if (Array.isArray(val)) {
                list = [...list, ...val];
            }
        });
    }

    // Filter duplicates based on slug/id
    const seen = new Set();
    const uniqueList = list.filter(item => {
        const id = item.slug || item.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    return uniqueList.map(normalizeHiShort);
}

export async function searchHiShort(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchFromApi(`/search/${encodeURIComponent(query)}?lang=in`);

    // API returns Array directly
    if (!data || !Array.isArray(data)) return [];

    return data.map(normalizeHiShort);
}

export async function getHiShortDetail(id: string): Promise<{ drama: UnifiedDrama, episodes: any[] } | null> {
    const data = await fetchFromApi(`/drama/${id}?lang=in`);

    if (!data) return null;

    // Data is the drama object directly
    const drama = normalizeHiShort(data);

    let episodes: any[] = [];

    if (data.episodes && Array.isArray(data.episodes)) {
        episodes = data.episodes.map((ep: any, index: number) => ({
            id: ep.slug || ep.id || `${id}_${index + 1}`,
            name: ep.title || `Episode ${ep.number || index + 1}`,
            index: ep.number ? ep.number - 1 : index,
            raw: ep
        }));
    } else if (drama.chapterCount) {
        const total = drama.chapterCount;
        for (let i = 1; i <= total; i++) {
            episodes.push({
                id: `${id}_${i}`,
                name: `Episode ${i}`,
                index: i - 1,
                raw: { episodeNum: i }
            });
        }
    }

    return { drama, episodes };
}

export async function getHiShortVideoUrl(episodeId: string): Promise<string> {
    const data = await fetchFromApi(`/episode/${episodeId}?lang=in`);

    if (!data) return '';

    // Debug logging
    console.log(`[HiShort] Response for ${episodeId}: keys=${Object.keys(data).join(',')}`);

    // Structure: { sources: [{ url, type }], subtitles: [] }
    // Or: { servers: [{ name, url, type }], ... }
    const sources = data.sources || data.servers;

    if (sources && Array.isArray(sources) && sources.length > 0) {
        console.log(`[HiShort] Found ${sources.length} sources/servers`);
        const videoUrl = sources[0].url;

        // Handle Subtitles
        if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
            return JSON.stringify({
                videoUrl: videoUrl,
                subtitles: data.subtitles.map((sub: any) => ({
                    label: sub.lang === 'id' ? 'Indonesia' : (sub.label || sub.lang),
                    lang: sub.lang,
                    url: sub.url
                }))
            });
        }

        return videoUrl;
    } else {
        console.log('[HiShort] No sources/servers found in data');
    }

    return data.videoUrl || data.url || '';
}
