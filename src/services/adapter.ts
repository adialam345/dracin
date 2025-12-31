export interface UnifiedDrama {
    id: string;
    title: string;
    cover: string;
    description?: string;
    source: 'dramabox' | 'netshort' | 'melolo' | 'radreel';
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

export function normalizeAny(data: any, defaultSource: 'dramabox' | 'netshort' | 'melolo' | 'radreel' = 'dramabox'): UnifiedDrama {
    // If source is explicitly known, try that normalizer first
    if (defaultSource === 'melolo') return normalizeMelolo(data);
    if (defaultSource === 'netshort') return normalizeNetshort(data);
    if (defaultSource === 'dramabox') return normalizeDramabox(data);
    if (defaultSource === 'radreel') return normalizeRadReel(data);

    // Fallback detection (legacy)
    if (data.fakeId && data.compilationsId) return normalizeRadReel(data);
    if (data.book_id && data.book_name) return normalizeMelolo(data);
    if (data.shortPlayId) return normalizeNetshort(data);

    return normalizeDramabox(data);
}
