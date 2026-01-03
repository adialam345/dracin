import { normalizeDramaDash, type UnifiedDrama } from '../adapter';

const API_BASE = 'https://dramadash.app/api';

const HEADERS = {
    'Host': 'dramadash.app',
    'Accept': 'application/json',
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vZHJhbWFkYXNoLmFwcC9hcGkvbGFuZGluZyIsImlhdCI6MTc2NzQzODIxNSwiZXhwIjoxNzY4NjQ3ODE1LCJuYmYiOjE3Njc0MzgyMTUsImp0aSI6IktPMDZ6aHlacmE3MmlYSkUiLCJzdWIiOiIxNzU3NzMzIiwicHJ2IjoiMjNiZDVjODk0OWY2MDBhZGIzOWU3MDFjNDAwODcyZGI3YTU5NzZmNyIsImlzX2d1ZXN0Ijp0cnVlLCJwbGF0Zm9ybSI6ImlvcyIsImFwcF92ZXJzaW9uIjoiNTAiLCJ0b2tlbl90eXBlIjoiYXV0aGVudGljYXRpb24ifQ.eTx6Hau_PiHJlZ8uTSpRZQxSMHaiOdZGO7yJ79h7Cyo',
    'app-version': '50',
    'tz': 'Asia/Jakarta',
    'device-type': 'phone',
    'Accept-Language': 'id-ID,id;q=0.9',
    'platform': 'ios',
    'User-Agent': 'DramaDash/50 CFNetwork/1474 Darwin/23.0.0',
    'lang': 'id'
};

export async function getDramaDashForYou(): Promise<UnifiedDrama[]> {
    try {
        const response = await fetch(`${API_BASE}/home`, {
            headers: HEADERS
        });

        if (!response.ok) return [];
        const data = await response.json();

        let allItems: any[] = [];

        // Extract from dramaList
        if (data.dramaList && Array.isArray(data.dramaList)) {
            data.dramaList.forEach((group: any) => {
                if (group.list && Array.isArray(group.list)) {
                    allItems.push(...group.list);
                }
            });
        }

        // Extract from bannerDramaList if present
        if (data.bannerDramaList && data.bannerDramaList.list && Array.isArray(data.bannerDramaList.list)) {
            allItems.push(...data.bannerDramaList.list);
        }

        // Deduplicate by ID
        const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());

        return uniqueItems.map(item => normalizeDramaDash(item));
    } catch (e) {
        console.error('[DramaDash] Home Error:', e);
        return [];
    }
}

export async function getDramaDashDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    try {
        const response = await fetch(`${API_BASE}/drama/${id}`, {
            headers: HEADERS
        });

        if (!response.ok) return { drama: null, episodes: [] };
        const data = await response.json();

        if (!data || !data.drama) return { drama: null, episodes: [] };

        const dramaData = data.drama;

        const dramaInfo = {
            title: dramaData.name,
            cover: dramaData.poster,
            description: dramaData.description,
            chapterCount: dramaData.episodes ? dramaData.episodes.length : 0,
            viewCount: 0, // Not explicitly in detail, maybe in home?
            source: 'dramadash'
        };

        const episodes = (dramaData.episodes || []).map((ep: any) => ({
            id: String(ep.id),
            name: `Episode ${ep.episodeNumber}`,
            index: ep.episodeNumber,
            unlock: !ep.isLocked || !!ep.videoUrl,
            raw: {
                ...ep,
                // Assign videoUrl to hls_url for compatibility with our player logic
                hls_url: ep.videoUrl
            }
        }));

        return { drama: dramaInfo, episodes };

    } catch (e) {
        console.error('[DramaDash] Detail Error:', e);
        return { drama: null, episodes: [] };
    }
}

// TODO: Implement search if endpoint is discovered.
// For now, we return empty to avoid errors.
export async function searchDramaDash(query: string): Promise<UnifiedDrama[]> {
    try {
        const response = await fetch(`${API_BASE}/search/text`, {
            method: 'POST',
            headers: {
                ...HEADERS,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ search: query })
        });

        if (!response.ok) return [];
        const data = await response.json();

        // Check if data.result exists and is an array
        if (data.result && Array.isArray(data.result)) {
            return data.result.map((item: any) => normalizeDramaDash(item));
        }

        return [];
    } catch (e) {
        console.error('[DramaDash] Search Error:', e);
        return [];
    }
}
