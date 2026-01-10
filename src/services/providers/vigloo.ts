import { normalizeVigloo, type UnifiedDrama } from '../adapter';
import { fetchCached, withCache } from '../utils';

const VIGLOO_BASE = 'https://dramabos.asia/api/viglo/api/v1';

export async function fetchVigloo(endpoint: string): Promise<any> {
    const url = `${VIGLOO_BASE}${endpoint}`;

    try {
        // Try direct fetch first
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
        // Fallback to proxy
    }

    return fetchCached(url);
}

export async function getViglooHome(): Promise<UnifiedDrama[]> {
    const data = await fetchVigloo('/rank?lang=id');
    if (!data || !data.payloads) return [];

    const items = data.payloads
        .filter((p: any) => p.program)
        .map((p: any) => normalizeVigloo(p.program));

    // Deduplicate
    const unique = new Map();
    for (const item of items) {
        if (!unique.has(item.id)) {
            unique.set(item.id, item);
        }
    }
    return Array.from(unique.values());
}

export async function searchVigloo(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchVigloo(`/search?q=${encodeURIComponent(query)}&lang=id`);
    if (!data || !data.payloads) return [];

    return data.payloads
        .filter((p: any) => p.program)
        .map((p: any) => normalizeVigloo(p.program));
}

const episodeCache = new Map<string, any[]>();

export async function getViglooDetail(id: string): Promise<{ drama: any, episodes: any[] } | null> {
    return withCache(`vigloo_detail_v2_${id}`, async () => {
        const data = await fetchVigloo(`/program/${id}`);
        if (!data || !data.payload) return null;

        const drama = normalizeVigloo(data.payload);

        // Get episodes from the seasons endpoint
        const seasonsData = await fetchVigloo(`/program/${id}/seasons`);
        let episodes: any[] = [];

        if (seasonsData && seasonsData.payloads && seasonsData.payloads.length > 0) {
            // Just take the first season for now
            const season = seasonsData.payloads[0];
            if (season.episodes) {
                episodeCache.set(String(id), season.episodes);
                episodes = season.episodes.map((ep: any) => ({
                    id: String(ep.episodeNumber),
                    name: `Episode ${ep.episodeNumber}`,
                    index: ep.episodeNumber - 1,
                    unlock: ep.price === 0,
                    raw: { ...ep, seasonId: season.id }
                }));
            }
        }

        return { drama, episodes };
    }, 60 * 60 * 1000);
}

export async function getViglooVideoUrl(programId: string, episodeNum: number): Promise<string> {
    try {
        let seasonId = '';
        const cached = episodeCache.get(programId);
        if (cached && cached.length > 0) {
            seasonId = cached[0].seasonId || cached[0].id; // The cache stores the raw episode objects
        }

        if (!seasonId) {
            const seasonsData = await fetchVigloo(`/program/${programId}/seasons`);
            if (seasonsData && seasonsData.payloads && seasonsData.payloads.length > 0) {
                seasonId = seasonsData.payloads[0].id;
            }
        }

        if (!seasonId) return '';

        const path = `/pool/play?seasonId=${seasonId}&ep=${episodeNum}`;
        const data = await fetchVigloo(path);

        if (!data || data.status !== 'OK') {
            if (data?.error) console.error('[Vigloo] Play API Error:', data.error);
            return '';
        }

        let videoUrl = '';
        if (data.payload && data.payload.url) videoUrl = data.payload.url;
        else if (data.url) videoUrl = data.url;
        else if (data.payload && data.payload.m3u8) videoUrl = data.payload.m3u8;

        if (videoUrl && data.cookies) {
            // Convert CloudFront cookies to query parameters
            // CloudFront-Policy=...; CloudFront-Signature=...; CloudFront-Key-Pair-Id=...
            const params = data.cookies
                .split(';')
                .map((s: string) => s.trim())
                .map((s: string) => {
                    // Remove 'CloudFront-' prefix for query parameters
                    return s.replace('CloudFront-', '');
                })
                .join('&');

            videoUrl += (videoUrl.includes('?') ? '&' : '?') + params;
        }

        if (videoUrl) return videoUrl;

        if (data.error) {
            console.error('[Vigloo] Play Error:', data.error);
        }
    } catch (e) {
        console.error('[Vigloo] Video URL exception:', e);
    }
    return '';
}
