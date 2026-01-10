import { encrypt } from '../utils/security.server';

export interface UnifiedDrama {
    id: string;
    title: string;
    cover: string;
    description?: string;
    chapterCount?: number;
    source: 'dramabox' | 'netshort' | 'melolo' | 'radreel' | 'dramawave' | 'dramaflickreels' | 'dramadash' | 'shortmax' | 'starshort' | 'freeshort' | 'hishort' | 'goodshort' | 'dotdrama' | 'stardusttv' | 'reelife' | 'meloshort' | 'vigloo';
    raw?: any;
}

export function normalizeMeloshort(data: any): UnifiedDrama {
    // Poster URL comes as "/img?url=https%3A%2F%2F..." or raw https
    let cover = data.poster || data.cover || '';
    if (cover.startsWith('/img?url=')) {
        // Option A: Use the API's proxy
        cover = 'https://apikupas.my.id' + cover;
        // Option B: Extract the real URL if prefer direct (but maybe 403?)
        // Let's stick to the proxy format or construct full URL if relative
    }

    return {
        id: data.slug || data.id,
        title: data.title || 'Unknown Title',
        cover: cover,
        description: data.description || '', // Not in Home feed
        chapterCount: 0, // Not in Home feed
        source: 'meloshort',
        raw: data
    };
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
        cover: data.cover ? `/api/proxy?q=${encodeURIComponent(encrypt(data.cover))}` : '',
        description: stripHtml(description),
        chapterCount: data.episode_count || (data.episode_list && data.episode_list.length) || 0,
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
        id: String(data.dramaId || data.id || ''),
        title: data.name || data.title || '',
        cover: data.cover || data.poster || data.coverUrl || '',
        description: data.summary || data.description || data.intro || data.introduction || '',
        source: 'shortmax',
        chapterCount: data.total || data.episodeCount || data.chapterCount || 0,
        raw: data
    };
}

export function normalizeHiShort(data: any): UnifiedDrama {
    return {
        id: String(data.slug || data.drama_id || data.id || ''),
        title: data.title || data.name || '',
        cover: data.cover || data.poster || '',
        description: data.description || data.synopsis || '',
        source: 'hishort',
        chapterCount: data.total_episodes || data.episodes_count || 0,
        raw: data
    };
}

export function normalizeFreeShort(data: any): UnifiedDrama {
    return {
        id: String(data.id || data.dramaId || ''),
        title: data.title || data.name || '',
        cover: data.cover || data.poster || '',
        description: data.description || data.summary || '',
        source: 'freeshort',
        chapterCount: data.total_episodes || data.total || data.episode_count || 0,
        raw: data
    };
}

export function normalizeStarShort(data: any): UnifiedDrama {
    // ID format: Prioritize fakeId (e.g. 1jG2) which matches sapimu API
    const id = data.fakeId || data.id || String(data.drama_id || '');

    return {
        id: id,
        title: stripHtml(data.title || data.name || ''),
        cover: data.cover || data.coverImgUrl || data.poster || '',
        description: stripHtml(data.introduction || data.introduce || data.description || data.desc || ''),
        source: 'starshort',
        chapterCount: data.uploadOfEpisodes || data.episodes_count || data.total_episodes || 0,
        raw: {
            ...data,
            videoUrl: data.videoUrl || ''
        },
    };
}

export function normalizeGoodShort(data: any): UnifiedDrama {
    return {
        id: String(data.bookId || data.id || ''),
        title: data.bookName || data.name || data.title || data.alias1 || '',
        cover: data.cover || data.bookDetailCover || '',
        description: data.introduction || data.desc || '',
        source: 'goodshort',
        chapterCount: data.chapterCount || data.chapterCnt || data.serializationStatus || 0,
        raw: data
    };
}

export function normalizeDotDrama(data: any): UnifiedDrama {
    const rawCover = data.pday || data.cover || '';
    const cover = rawCover ? `/api/proxy?q=${encodeURIComponent(encrypt(rawCover))}` : '';

    return {
        id: String(data.dcup || data.id || ''),
        title: data.nseri || data.title || '',
        cover: cover,
        description: data.dwill || data.description || '',
        source: 'dotdrama',
        chapterCount: data.ewood || 0,
        raw: data
    };
}

export function normalizeStarDustTV(data: any): UnifiedDrama {
    // Disable proxy for StardustTV images to avoid 504/403 errors (direct access works better)
    const cover = data.image || data.cover || '';

    return {
        id: String(data.vid || data.id || ''),
        title: data.title || '',
        cover: cover,
        description: data.description || '',
        source: 'stardusttv',
        chapterCount: 0, // Not provided in list
        raw: data
    };
}

export function normalizeReelLife(data: any): UnifiedDrama {
    return {
        id: String(data.id || ''),
        title: data.title || '',
        cover: data.poster || data.cover || '',
        description: '', // Description not available in home feed
        source: 'reelife',
        chapterCount: 0,
        raw: data
    };
}

export function normalizeVigloo(data: any): UnifiedDrama {
    // Disable proxy for Vigloo images to avoid 504/403 errors
    const cover = data.thumbnailExpanded || data.thumbnail || data.titleImage || '';

    return {
        id: String(data.id || ''),
        title: data.title || '',
        cover: cover,
        description: data.description || data.logLine || '',
        source: 'vigloo',
        chapterCount: data.episodeCount || 0,
        raw: data
    };
}

export function normalizeAny(data: any, defaultSource: 'dramabox' | 'netshort' | 'melolo' | 'radreel' | 'dramawave' | 'dramaflickreels' | 'dramadash' | 'shortmax' | 'starshort' | 'freeshort' | 'hishort' | 'goodshort' | 'dotdrama' | 'stardusttv' | 'reelife' | 'meloshort' | 'vigloo' = 'dramabox'): UnifiedDrama {
    // If source is explicitly known, try that normalizer first
    if (defaultSource === 'melolo') return normalizeMelolo(data);
    if (defaultSource === 'netshort') return normalizeNetshort(data);
    if (defaultSource === 'dramabox') return normalizeDramabox(data);
    if (defaultSource === 'radreel') return normalizeRadReel(data);
    if (defaultSource === 'dramawave') return normalizeDramaWave(data);
    if (defaultSource === 'dramaflickreels') return normalizeFlickReels(data);
    if (defaultSource === 'dramadash') return normalizeDramaDash(data);
    if (defaultSource === 'shortmax') return normalizeShortMax(data);
    if (defaultSource === 'starshort') return normalizeStarShort(data);
    if (defaultSource === 'freeshort') return normalizeFreeShort(data);
    if (defaultSource === 'hishort') return normalizeHiShort(data);
    if (defaultSource === 'goodshort') return normalizeGoodShort(data);
    if (defaultSource === 'dotdrama') return normalizeDotDrama(data);
    if (defaultSource === 'stardusttv') return normalizeStarDustTV(data);
    if (defaultSource === 'reelife') return normalizeReelLife(data);
    if (defaultSource === 'meloshort') return normalizeMeloshort(data);
    if (defaultSource === 'vigloo') return normalizeVigloo(data);

    // Fallback detection (legacy)
    if (data.fakeId && data.compilationsId) return normalizeRadReel(data);
    if (data.book_id && data.book_name) return normalizeMelolo(data);
    if (data.shortPlayId) return normalizeNetshort(data);
    if (data.key && data.h265_m3u8) return normalizeDramaWave(data); // Feed format
    if (data.id && data.name && data.series_tag) return normalizeDramaWave(data); // Search format
    if (data.playlet_id && data.title) return normalizeFlickReels(data);
    if (data.poster && data.videoUrl) return normalizeDramaDash(data); // Crude heuristic
    if (data.bookId && (data.alias1 || data.columnId)) return normalizeGoodShort(data); // GoodShort heuristic
    if (data.vid && (data.title || data.image)) return normalizeStarDustTV(data); // StarDust heuristic
    // Heuristic for ReelLife/Meloshort if needed (both have slug)
    // if (data.slug && data.poster) return normalizeReelLife(data);

    return normalizeDramabox(data);
}
