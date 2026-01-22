import { fetchCached } from '../utils';
import { normalizeAny, type UnifiedDrama } from '../adapter';

const API_BASE = 'https://dramabos.asia/api';

export async function getNontonDramaHome(): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/nontondrama/home');
    if (!data) return [];

    // Combine featured, latest, and popular
    const items: any[] = [
        ...(data.featured || []),
        ...(data.latest || []),
        ...(data.popular || [])
    ];

    // De-duplicate items by slug
    const uniqueItems = Array.from(new Map(items.map(item => [item.slug, item])).values());

    return uniqueItems.map(item => normalizeAny(item, 'nontondrama')).filter(i => i.id);
}

export async function searchNontonDrama(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchCached(API_BASE + '/nontondrama/search?q=' + encodeURIComponent(query));
    if (!Array.isArray(data)) return [];
    return data.map(item => normalizeAny(item, 'nontondrama')).filter(i => i.id);
}

export async function getNontonDramaDetail(slug: string): Promise<{ drama: any, episodes: any[] }> {
    const data = await fetchCached(API_BASE + '/nontondrama/detail/' + slug);
    if (!data) return { drama: null, episodes: [] };

    const dramaInfo = {
        title: data.title,
        cover: data.poster,
        description: data.synopsis,
        genres: data.genres || [],
        countries: data.countries || [],
        actors: data.actors || [],
        source: 'nontondrama'
    };

    const episodes = (data.episodes || []).map((e: any) => ({
        id: e.slug,
        name: e.title,
        index: e.episode,
        season: e.season,
        ...e
    }));

    return {
        drama: dramaInfo,
        episodes
    };
}

export async function getNontonDramaStream(episodeSlug: string): Promise<any[]> {
    const data = await fetchCached(API_BASE + '/nontondrama/stream/' + episodeSlug);
    return Array.isArray(data) ? data : [];
}
