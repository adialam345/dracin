import { encryptRequestParams, decryptResponseData } from '../../utils/shortmax-crypto';
import { normalizeShortMax, type UnifiedDrama } from '../adapter';
import { fetchCached, withCache } from '../utils';

// 🌍 GUNAKAN WEB API URL
const API_BASE = 'https://shortweb.shorttv.live/app-api';

const BASE_HEADERS = {
    'Accept': 'application/json',
    'x-encrypted': 'true', // Header wajib untuk Web API
    'Accept-Language': 'id-ID,id;q=0.9',
    'Content-Type': 'application/json',
    'language-code': 'id',
    'Origin': 'https://www.shorttv.live',
    'Referer': 'https://www.shorttv.live/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * Call API Wrapper
 */
async function callShortMaxApi(endpoint: string, params: any = {}) {
    try {
        // 1. Encrypt Body
        const encryptedBody = encryptRequestParams(params);

        // console.log(`[ShortMax] Requesting ${endpoint}...`);

        // 2. Fetch ke API Web
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: BASE_HEADERS,
            body: encryptedBody
        });

        if (!response.ok) {
            console.error(`[ShortMax] ${response.status} ${response.statusText}`);
            return null;
        }

        // 3. Ambil Text Response (karena terenkripsi dan mungkin bukan valid JSON mentah)
        const rawText = await response.text();

        // 4. Decrypt
        const decrypted = decryptResponseData(rawText);

        return decrypted;
    } catch (e) {
        console.error(`[ShortMax] Error:`, e);
        return null;
    }
}

/**
 * Get Homepage / Trending
 */
/**
 * Get Homepage / Trending
 * Updated to use /app/cmsShortPlay/queryPage which includes covers!
 */
export async function getShortMaxForYou(): Promise<UnifiedDrama[]> {
    try {
        // Endpoint baru dengan valid cover images
        const data = await callShortMaxApi('/app/cmsShortPlay/queryPage', {
            pageNo: 1,
            pageSize: 30 // Ambil lebih banyak untuk homepage
        });

        if (!data || data.code !== 0 || !data.data || !data.data.list) return [];

        // Map hasil ke format UnifiedDrama
        return data.data.list.map((item: any) => normalizeShortMax({
            id: String(item.shortPlayId), // Use ID strictly as the internal ID
            dramaId: item.shortPlayId,
            name: item.shortPlayName,
            title: item.shortPlayName,
            cover: item.coverId || item.coverUrl,
            shortPlayCode: item.shortPlayCode,
            raw: item
        }));
    } catch (e) {
        console.error('[ShortMax] Error fetching home:', e);
        return [];
    }
}

/**
 * Search Drama
 */
// External APIs
const SHORTMAX_SEARCH_API = 'https://dramabos.asia/api/shortmax/api/v1/search';

export async function searchShortMax(query: string): Promise<UnifiedDrama[]> {
    try {
        // console.log(`[ShortMax] Searching via external API: ${query}`);
        const response = await fetch(`${SHORTMAX_SEARCH_API}?q=${encodeURIComponent(query)}&lang=id`, {
            headers: {
                'Authorization': `Bearer ${getRandomToken()}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`[ShortMax] Search error: ${response.status}`);
            return [];
        }

        const json = await response.json();

        if (!json || !json.data || !Array.isArray(json.data)) return [];

        return json.data.map((item: any) => normalizeShortMax({
            id: String(item.code || item.id), // Prefer code (shortPlayId) if available
            dramaId: item.code || item.id,
            title: item.name,
            cover: item.cover,
            description: item.summary,
            // External API structure is slightly different, adapt normalizer or pass necessary fields
            raw: item
        }));
    } catch (e) {
        console.error('[ShortMax] Search exception:', e);
        return [];
    }
}

/**
 * Get signed video URL with auth_key for playback
 * Uses external API that provides authenticated streaming URLs
 */
const SHORTMAX_PLAY_API = 'https://dramabos.asia/api/shortmax/api/v1/play';

// Pool of tokens to rotate to avoid rate limits (100 req/min, 2000/day per token)
const API_TOKENS = [
    '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb', // Original
    'ba3f5eb1a23ef0c00dee764bd05cee7bc6606453deca551185301200cf35b941', // kido345
    '8c02960a5aa268ac4ca89b9e86d9d93ea4bb257ed9dc89bc584e3e4aa87c9d8d', // nxxzzz286919
    'b53a335e49b725f092cda317fee26c2707c5eb2f5bc87a60eb1a1367aa6b090e'  // nexsus72
];

function getRandomToken() {
    return API_TOKENS[Math.floor(Math.random() * API_TOKENS.length)];
}

export async function getShortMaxVideoUrl(shortPlayId: string, episodeNum: number): Promise<string> {
    // Shuffle tokens to avoid hot-spotting the first one, but try ALL of them if needed
    const tokens = [...API_TOKENS].sort(() => Math.random() - 0.5);

    // Try tokens sequentially
    for (const token of tokens) {
        try {
            const url = `${SHORTMAX_PLAY_API}/${shortPlayId}?lang=id&ep=${episodeNum}`;
            // console.log(`[ShortMax] Fetching video URL with token ending in ...${token.slice(-6)}`);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.warn(`[ShortMax] Token failed (${response.status}). Retrying...`);
                continue;
            }

            const data = await response.json();

            if (data && data.data && data.data.video) {
                const video = data.data.video;
                // Check if video object itself is the URL (sometimes API changes)
                if (typeof video === 'string' && video.startsWith('http')) {
                    return video;
                }

                const videoUrl = video.video_720 || video.video_1080 || video.video_480 || '';

                if (videoUrl) {
                    // console.log(`[ShortMax] Got signed video URL for episode ${episodeNum}`);
                    return videoUrl;
                }
            } else if (data && data.code !== 0) {
                console.warn(`[ShortMax] API error code: ${data.code} (${data.msg}). Retrying with next token...`);
                continue;
            }

        } catch (e) {
            console.error('[ShortMax] Token exception:', e);
            // Continue to next token
        }
    }

    console.error('[ShortMax] All tokens failed or no video URL found inside response.');
    return '';
}


export async function getShortMaxDetail(id: string, knownCover?: string): Promise<{ drama: any, episodes: any[] } | null> {
    const cacheKey = `sm_detail_v3_${id}`;
    return withCache(cacheKey, async () => {
        try {
            const url = `${SHORTMAX_PLAY_API}/${id}?lang=id&ep=1`;
            const json = await fetchCached(url, 2, {
                'Authorization': `Bearer ${getRandomToken()}`
            });

            if (!json || !json.data) {
                return null;
            }

            const d = json.data;
            let coverUrl = knownCover || '';

            if (!coverUrl && d.name) {
                try {
                    const cleanName = d.name.replace(/^\[.*?\]\s*/, '').trim();
                    const searchResults = await searchShortMax(cleanName);
                    const match = searchResults.find(s =>
                        String(s.id) === String(id) ||
                        s.title.toLowerCase() === d.name.toLowerCase() ||
                        s.title.toLowerCase().includes(cleanName.toLowerCase())
                    );
                    if (match) coverUrl = match.cover;
                    else if (searchResults.length > 0) coverUrl = searchResults[0].cover;
                } catch (err) {
                    console.warn('[ShortMax] Failed to fetch cover via search:', err);
                }
            }

            const drama = {
                id: id,
                title: d.name || d.title,
                cover: coverUrl || '',
                description: d.summary || '',
                chapterCount: d.total || 0,
                labels: [],
                source: 'shortmax'
            };

            const episodes = [];
            const total = d.total || 0;
            for (let i = 1; i <= total; i++) {
                episodes.push({
                    id: `${id}_${i}`,
                    name: `Episode ${i}`,
                    index: i - 1,
                    unlock: true,
                    raw: {
                        episodeNum: i,
                        ...(i === 1 ? { videoUrl: d.video?.video_720 || d.video?.video_480 } : {})
                    }
                });
            }

            return { drama, episodes };
        } catch (e) {
            console.error('[ShortMax] Error fetching detail:', e);
            return null;
        }
    }, 60 * 60 * 1000); // Cache for 1 hour
}
