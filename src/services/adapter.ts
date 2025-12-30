export interface UnifiedDrama {
    id: string;
    title: string;
    cover: string;
    description?: string;
    source: 'dramabox' | 'netshort' | 'melolo';
    raw?: any;
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
    return {
        id: data.shortPlayId || data.id,
        title: data.shortPlayName || data.title || data.name,
        cover: data.shortPlayCover || data.cover || data.coverUrl,
        description: data.introduction || data.desc || '',
        source: 'netshort',
        raw: data,
    };
}

export function normalizeMelolo(data: any): UnifiedDrama {
    let cover = data.cover_url || data.cover || data.thumb_url || '';

    // Use images.weserv.nl to convert HEIC to WebP automatically
    // This is a free CDN service that handles format conversion
    if (cover && cover.includes('.heic')) {
        // Encode the original URL and use weserv.nl to convert it
        cover = `https://images.weserv.nl/?url=${encodeURIComponent(cover)}&output=webp&q=85`;
    }

    return {
        id: data.book_id || data.id,
        title: data.book_name || data.name,
        cover: cover,
        description: data.abstract || data.summary || '',
        source: 'melolo',
        raw: data,
    };
}

export function normalizeAny(data: any, defaultSource: 'dramabox' | 'netshort' | 'melolo' = 'dramabox'): UnifiedDrama {
    // Melolo specific fields
    if (data.book_id && data.book_name && data.abstract) {
        return normalizeMelolo(data);
    }

    // NetShort specific fields
    if (data.shortPlayId && data.shortPlayName) {
        return normalizeNetshort(data);
    }

    // Dramabox fallback
    return normalizeDramabox(data);
}
