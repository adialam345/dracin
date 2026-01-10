
import { normalizeMeloshort, type UnifiedDrama } from '../adapter';
import { fetchCached, withCache } from '../utils';

const API_BASE = 'https://dramabos.asia/api/meloshort/api';
const BERANDA_API = `${API_BASE}/ranking?page=1&page_size=20`;
const SEARCH_API = `${API_BASE}/search`;
const DETAIL_API = `${API_BASE}/drama`;
const PLAY_API = `${API_BASE}/play`;

/**
 * Get Meloshort Homepage / For You
 */
export async function getMeloshortForYou(): Promise<UnifiedDrama[]> {
    try {
        const json = await fetchCached(BERANDA_API);

        if (json && json.code === 0 && json.data?.place_list) {
            const allItems: any[] = [];
            json.data.place_list.forEach((p: any) => {
                if (p.list && Array.isArray(p.list)) {
                    allItems.push(...p.list);
                }
            });

            // Deduplicate
            const unique = new Map();
            for (const item of allItems) {
                if (item.drama_id) unique.set(item.drama_id, item);
            }

            return Array.from(unique.values()).map(normalizeMeloshort);
        }

        return [];
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
        const url = `${SEARCH_API}?q=${encodeURIComponent(query)}&page=1&page_size=20`;
        const json = await fetchCached(url);

        if (json && json.code === 0 && Array.isArray(json.data)) {
            return json.data.map(normalizeMeloshort);
        }

        return [];
    } catch (e) {
        console.error('[Meloshort] Search exception:', e);
        return [];
    }
}

/**
 * Get Detail
 */
export async function getMeloshortDetail(id: string): Promise<{ drama: any, episodes: any[] } | null> {
    return withCache(`ms_detail_v2_${id}`, async () => {
        try {
            // Step 1: Fetch Drama Metadata from Play API (Episode 1 usually has it)
            // Sequential is bad, but these are small JSONs. fetchCached should help.
            const playUrl = `${PLAY_API}/${id}/1`;
            const playJson = await fetchCached(playUrl);
            let dramaMetadata: any = null;

            if (playJson && playJson.code === 0 && playJson.data) {
                const d = playJson.data;
                dramaMetadata = {
                    id: id,
                    title: d.drama_title || d.title,
                    cover: d.drama_cover || d.cover,
                    description: d.drama_description || d.description || '',
                    chapterCount: d.chapters || 0,
                    labels: d.drama_tags || (d.drama_sub_tags || []).map((t: any) => t.title) || [],
                    source: 'meloshort'
                };
            }

            // Step 2: Fetch Episode List from Drama API
            const detailUrl = `${DETAIL_API}/${id}`;
            const detailJson = await fetchCached(detailUrl);
            let episodes = [];

            if (detailJson && detailJson.code === 0 && Array.isArray(detailJson.data)) {
                episodes = detailJson.data.map((ep: any) => ({
                    id: String(ep.chapter_index),
                    name: ep.chapter_name || `Episode ${ep.chapter_index}`,
                    index: ep.chapter_index - 1,
                    unlock: true,
                    raw: { dramaId: id, episodeNum: ep.chapter_index }
                }));
            }

            // Fallback: If drama metadata couldn't be fetched (e.g. play/1 failed) but we have episodes
            if (!dramaMetadata && episodes.length > 0) {
                dramaMetadata = {
                    id: id,
                    title: 'Meloshort Drama',
                    cover: '',
                    description: '',
                    chapterCount: episodes.length,
                    labels: [],
                    source: 'meloshort'
                };
            }

            if (!dramaMetadata) return null;

            // If metadata has chapterCount but episodes list is empty, generate synthetic ones
            if (episodes.length === 0 && dramaMetadata.chapterCount > 0) {
                for (let i = 1; i <= dramaMetadata.chapterCount; i++) {
                    episodes.push({
                        id: String(i),
                        name: `Episode ${i}`,
                        index: i - 1,
                        unlock: true,
                        raw: { dramaId: id, episodeNum: i }
                    });
                }
            }

            return { drama: dramaMetadata, episodes };
        } catch (e) {
            console.error('[Meloshort] Detail exception:', e);
            return null;
        }
    }, 60 * 60 * 1000); // Cache for 1 hour
}

/**
 * Get Video URL
 */
export async function getMeloshortVideoUrl(id: string, episodeNum: number): Promise<string> {
    try {
        const url = `${PLAY_API}/${id}/${episodeNum}`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[Meloshort] Video error: ${response.status}`);
            return '';
        }

        const json = await response.json();

        if (json.code === 0 && json.data) {
            const data = json.data;
            const videoUrl = data.full_play_url || data.play_url || '';

            // Subtitles handling
            if (data.sublist && Array.isArray(data.sublist) && data.sublist.length > 0) {
                return JSON.stringify({
                    videoUrl: videoUrl,
                    subtitles: data.sublist.map((sub: any) => ({
                        label: sub.language === 'ind-ID' ? 'Indonesia' : sub.language,
                        lang: sub.language || 'id-ID',
                        url: sub.url
                    }))
                });
            }

            return videoUrl;
        }

        return '';
    } catch (e) {
        console.error('[Meloshort] Video exception:', e);
        return '';
    }
}
