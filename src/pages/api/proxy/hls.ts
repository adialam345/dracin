import { encrypt } from '../../../utils/security.server';

// Simple in-memory cache to save CPU
const hlsCache = new Map<string, { content: string, expiry: number }>();

export async function handleHlsRewrite(response: Response, targetUrl: string, origin: string): Promise<Response> {
    const text = await response.text();
    const isVOD = text.includes('#EXT-X-ENDLIST');

    // Cache Key combining target and origin
    const cacheKey = `${targetUrl}|${origin}`;
    const now = Date.now();

    // Serve from cache if available (VOD only)
    if (isVOD && hlsCache.has(cacheKey)) {
        const cached = hlsCache.get(cacheKey)!;
        if (cached.expiry > now) {
            return new Response(cached.content, {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=3600',
                    'X-Proxy-Cache': 'HIT'
                }
            });
        }
    }

    const baseUrl = new URL('.', targetUrl).href;
    const urlObj = new URL(targetUrl);
    const searchParams = urlObj.search;

    // Gunakan Regex Global untuk mengganti URL sekaligus (lebih hemat RAM daripada split/map/join)
    let newText = text;

    // 1. Ganti URL Segment (baris yang tidak diawali #)
    newText = newText.replace(/^(?!#)(.+)$/gm, (match, uri) => {
        try {
            const trimmedUri = uri.trim();
            if (!trimmedUri) return match;
            let absoluteUrl = new URL(trimmedUri, baseUrl).href;
            if (searchParams) {
                const separator = absoluteUrl.includes('?') ? '&' : '?';
                absoluteUrl += separator + searchParams.replace('?', '');
            }
            const encryptedUrl = encrypt(absoluteUrl);
            return `${origin}/api/proxy?q=${encodeURIComponent(encryptedUrl)}`;
        } catch (e) {
            return match;
        }
    });

    // 2. Ganti URI dalam tag (misal key atau sub-playlist)
    newText = newText.replace(/URI="([^"]+)"/g, (match, uri) => {
        try {
            let absoluteUrl = new URL(uri, baseUrl).href;
            if (searchParams) {
                const separator = absoluteUrl.includes('?') ? '&' : '?';
                absoluteUrl += separator + searchParams.replace('?', '');
            }
            const encryptedUrl = encrypt(absoluteUrl);
            return `URI="${origin}/api/proxy?q=${encodeURIComponent(encryptedUrl)}"`;
        } catch (e) {
            return match;
        }
    });

    // Store in cache if VOD
    if (isVOD) {
        hlsCache.set(cacheKey, { content: newText, expiry: now + 3600000 });
        if (hlsCache.size > 100) {
            const firstKey = hlsCache.keys().next().value;
            if (firstKey) hlsCache.delete(firstKey);
        }
    }

    return new Response(newText, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': isVOD ? 'public, max-age=3600' : 'public, max-age=15',
            'X-Proxy-Cache': 'MISS'
        }
    });
}

function trimmingLine(line: string) {
    return line && !line.startsWith('#');
}
