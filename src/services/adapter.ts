export interface UnifiedDrama {
    id: string;
    title: string;
    cover: string;
    description?: string;
    chapterCount?: number;
    source: 'dramabox' | 'netshort' | 'melolo' | 'radreel' | 'dramawave' | 'dramaflickreels' | 'dramadash' | 'shortmax';
    raw?: any;
}

// Helper function to strip HTML tags from text
function stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
}

export function normalizeDramabox(data: any): UnifiedDrama {
    return {
        id: data.bookId || data.book_id,
        title: data.bookName || data.book_name,
        cover: data.coverWap || data.cover || data.bookCover || data.cover_url,
        description: data.introduction || data.desc || '',
        source: 'dramabox',
        raw: data,
    };
}

export function normalizeNetshort(data: any): UnifiedDrama {
    const rawTitle = data.shortPlayName || data.title || data.name;
    return {
        id: data.shortPlayId || data.id,
        title: stripHtml(rawTitle), // Remove HTML tags like <em>
        cover: data.shortPlayCover || data.cover || data.coverUrl,
        description: data.introduction || data.desc || '',
        source: 'netshort',
        raw: data,
    };
}

export function normalizeMelolo(data: any): UnifiedDrama {
    let cover = data.cover_url || data.cover || data.thumb_url || '';

    // Use images.weserv.nl to convert HEIC to WebP automatically
    if (cover && cover.includes('.heic')) {
        cover = `https://images.weserv.nl/?url=${encodeURIComponent(cover)}&output=webp&q=85`;
    }

    return {
        id: data.book_id || data.id || data.series_id,
        title: data.book_name || data.name || data.title,
        cover: cover,
        description: data.abstract || data.summary || data.series_intro || '',
        source: 'melolo',
        raw: data,
    };
}

export function normalizeRadReel(data: any): UnifiedDrama {
    // ID format: fakeId_compilationsId
    // If coming from search or list, we might have videoUrl directly
    const id = (data.fakeId && data.compilationsId)
        ? `${data.fakeId}_${data.compilationsId}`
        : (data.compilationsFakeId && data.compilationsId)
            ? `${data.compilationsFakeId}_${data.compilationsId}`
            : (data.id || '');

    return {
        id: id,
        title: stripHtml(data.title || ''),
        cover: data.coverImgUrl || '',
        description: stripHtml(data.introduction || data.introduce || ''),
        source: 'radreel',
        raw: {
            ...data,
            videoUrl: data.videoUrl || '' // IMPORTANT: Save videoUrl if present
        },
    };
}

export function normalizeDramaWave(data: any): UnifiedDrama {
    // DramaWave has different structures for feed vs search:
    // Feed: { key, title, cover, intro, h265_m3u8, h264_m3u8, next_episode }
    // Search: { id, name, desc, cover, labels, series_tag }

    const id = data.key || data.id || '';
    const title = data.title || data.name || '';
    const description = data.intro || data.introduction || data.desc || '';

    // Video URL: Only available in feed items, not in search results
    let videoUrl = data.h265_m3u8 || data.h264_m3u8 || '';

    // Next Episode Logic (only in feed)
    const nextEpisode = data.next_episode || null;

    return {
        id: id,
        title: stripHtml(title),
        cover: data.cover || '',
        description: stripHtml(description),
        source: 'dramawave',
        raw: {
            ...data,
            videoUrl: videoUrl,
            nextEpisode: nextEpisode
        }
    };
}

export function normalizeDramaDash(data: any): UnifiedDrama {
    return {
        id: String(data.id || ''),
        title: data.name || data.title || '',
        cover: data.poster || data.cover || '',
        description: data.description || '',
        source: 'dramadash',
        raw: data
    };
}

export function normalizeFlickReels(data: any): UnifiedDrama {
    return {
        id: String(data.playlet_id || ''),
        title: data.title || '',
        cover: data.cover || '',
        description: data.introduce || '',
        source: 'dramaflickreels',
        chapterCount: data.upload_num ? parseInt(data.upload_num) : 0,
        raw: data
    };
}

export function normalizeShortMax(data: any): UnifiedDrama {
    return {
        id: String(data.id || data.dramaId || ''),
        title: data.name || data.title || '',
        cover: data.cover || data.poster || data.coverUrl || '',
        description: data.description || data.intro || data.introduction || '',
        source: 'shortmax',
        chapterCount: data.episodeCount || data.chapterCount || 0,
        raw: data
    };
}

export function normalizeAny(data: any, defaultSource: 'dramabox' | 'netshort' | 'melolo' | 'radreel' | 'dramawave' | 'dramaflickreels' | 'dramadash' | 'shortmax' = 'dramabox'): UnifiedDrama {
    // If source is explicitly known, try that normalizer first
    if (defaultSource === 'melolo') return normalizeMelolo(data);
    if (defaultSource === 'netshort') return normalizeNetshort(data);
    if (defaultSource === 'dramabox') return normalizeDramabox(data);
    if (defaultSource === 'radreel') return normalizeRadReel(data);
    if (defaultSource === 'dramawave') return normalizeDramaWave(data);
    if (defaultSource === 'dramaflickreels') return normalizeFlickReels(data);
    if (defaultSource === 'dramadash') return normalizeDramaDash(data);
    if (defaultSource === 'shortmax') return normalizeShortMax(data);

    // Fallback detection (legacy)
    if (data.fakeId && data.compilationsId) return normalizeRadReel(data);
    if (data.book_id && data.book_name) return normalizeMelolo(data);
    if (data.shortPlayId) return normalizeNetshort(data);
    if (data.key && data.h265_m3u8) return normalizeDramaWave(data); // Feed format
    if (data.id && data.name && data.series_tag) return normalizeDramaWave(data); // Search format
    if (data.playlet_id && data.title) return normalizeFlickReels(data);
    if (data.poster && data.videoUrl) return normalizeDramaDash(data); // Crude heuristic

    return normalizeDramabox(data);
}
