import { encryptRequestParams, decryptResponseData } from '../../utils/shortmax-crypto';
import { normalizeShortMax, type UnifiedDrama } from '../adapter';

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

        console.log(`[ShortMax] Requesting ${endpoint}...`);

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
export async function searchShortMax(query: string): Promise<UnifiedDrama[]> {
    try {
        const data = await callShortMaxApi('/app/search/search', {
            keyword: query
        });

        if (!data || data.code !== 0 || !data.data) return [];

        return data.data.map((item: any) => normalizeShortMax({
            id: String(item.shortPlayId),
            dramaId: item.shortPlayId,
            title: item.shortPlayName,
            cover: item.coverId || item.coverUrl, // API Search biasanya return cover
            shortPlayCode: item.shortPlayCode,
            raw: item
        }));
    } catch (e) {
        return [];
    }
}

export async function getShortMaxDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    try {
        const data = await callShortMaxApi('/app/cmsShortPlay/queryDetail', {
            shortPlayId: id
        });

        if (!data || data.code !== 0 || !data.data) return { drama: null, episodes: [] };

        const d = data.data;

        // Extract Drama Info
        const drama = {
            id: d.shortPlayCode || d.shortPlayId,
            title: d.shortPlayName,
            cover: d.coverId || d.coverUrl,
            description: d.summary || '',
            chapterCount: d.episodeList ? d.episodeList.length : 0,
            labels: (d.labelList || []).map((l: any) => l.name),
            source: 'shortmax'
        };

        // Extract Episodes
        const episodes = (d.episodeList || []).map((ep: any) => {
            let videoUrl = '';

            // Parse encryptedVideoUrl JSON
            if (ep.encryptedVideoUrl) {
                try {
                    const videoMap = JSON.parse(ep.encryptedVideoUrl);
                    // Prioritize 720 -> 540 -> 480 -> any
                    videoUrl = videoMap.video_720 || videoMap.video_540 || videoMap.video_480 || Object.values(videoMap)[0] || '';
                } catch (e) {
                    // console.warn('[ShortMax] Failed to parse video URL JSON from encryptedVideoUrl');
                }
            }

            return {
                id: `${drama.id}_${ep.episodeNum}`, // Construct unique ID for aggregator
                name: `Episode ${ep.episodeNum}`,
                index: ep.episodeNum,
                unlock: !!videoUrl, // Only unlock if we have a video URL
                raw: { ...ep, videoUrl }
            };
        });

        return { drama, episodes };
    } catch (e) {
        console.error('[ShortMax] Error fetching detail:', e);
        return { drama: null, episodes: [] };
    }
}
