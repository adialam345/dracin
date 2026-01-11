import { normalizeFlickReels, type UnifiedDrama } from '../adapter';

const API_BASE = 'https://dramabos.asia/api/flick';

export async function getFlickHome(): Promise<UnifiedDrama[]> {
    try {
        const response = await fetch(`${API_BASE}/home?page=1&page_size=20&lang=6`);
        if (!response.ok) return [];
        const data = await response.json();

        let allItems: any[] = [];
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach((group: any) => {
                if (group.list && Array.isArray(group.list)) {
                    allItems.push(...group.list);
                }
            });
        }

        // Deduplicate by playlet_id
        const uniqueItems = Array.from(new Map(allItems.map(item => [item.playlet_id, item])).values());

        return uniqueItems.map(item => {
            const normalized = normalizeFlickReels(item);
            normalized.source = 'flickreels';
            return normalized;
        });
    } catch (e) {
        console.error('[FlickReels] Home Error:', e);
        return [];
    }
}

export async function getFlickTrending(): Promise<UnifiedDrama[]> {
    try {
        const response = await fetch(`${API_BASE}/trending`);
        if (!response.ok) return [];
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
            return data.data.map((item: any) => {
                const normalized = normalizeFlickReels(item);
                normalized.source = 'flickreels';
                return normalized;
            });
        }
        return [];
    } catch (e) {
        console.error('[FlickReels] Trending Error:', e);
        return [];
    }
}

export async function getFlickDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    try {
        const response = await fetch(`${API_BASE}/drama/${id}?lang=6`);
        if (!response.ok) return { drama: null, episodes: [] };
        const data = await response.json();

        if (!data || !data.data) return { drama: null, episodes: [] };
        const info = data.data;

        // Extract labels from tag names if they exist (sometimes in detail info)
        const labels = info.tag_name ? (Array.isArray(info.tag_name) ? info.tag_name : [info.tag_name]) : [];

        const dramaInfo = {
            title: info.title,
            cover: info.cover,
            description: info.introduce || '',
            chapterCount: info.list ? info.list.length : 0,
            viewCount: info.collect_num || 0,
            labels: labels,
            source: 'flickreels'
        };

        const episodes = (info.list || []).map((ep: any) => ({
            id: String(ep.chapter_id),
            name: ep.chapter_title || `Episode ${ep.chapter_num}`,
            index: ep.chapter_num - 1,
            unlock: !ep.is_lock || !!ep.play_url,
            raw: {
                ...ep,
                hls_url: ep.play_url
            }
        }));

        return { drama: dramaInfo, episodes };
    } catch (e) {
        console.error('[FlickReels] Detail Error:', e);
        return { drama: null, episodes: [] };
    }
}

export async function searchFlick(query: string): Promise<UnifiedDrama[]> {
    try {
        const response = await fetch(`${API_BASE}/search?keyword=${encodeURIComponent(query)}&lang=6`);
        if (!response.ok) return [];
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
            return data.data.map((item: any) => {
                const normalized = normalizeFlickReels(item);
                normalized.source = 'flickreels';
                return normalized;
            });
        }
        return [];
    } catch (e) {
        console.error('[FlickReels] Search Error:', e);
        return [];
    }
}
