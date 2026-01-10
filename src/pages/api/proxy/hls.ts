import { encrypt } from '../../../utils/security.server';

// Simple in-memory cache to save CPU
const hlsCache = new Map<string, { content: string, expiry: number }>();

export async function handleHlsRewrite(response: Response, targetUrl: string, origin: string): Promise<Response> {
    const text = await response.text();
    const isVOD = text.includes('#EXT-X-ENDLIST');

    // Cache Key combining target and origin
    const cacheKey = `${targetUrl}|${origin}`;
    const now = Date.now();

    // Serve from cache if available and not expired (VOD only)
    if (isVOD && hlsCache.has(cacheKey)) {
        const cached = hlsCache.get(cacheKey)!;
        if (cached.expiry > now) {
            return new Response(cached.content, {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
                    'X-Proxy-Cache': 'HIT'
                }
            });
        }
    }

    const baseUrl = new URL('.', targetUrl).href;
    const urlObj = new URL(targetUrl);
    const searchParams = urlObj.search;

    const cacheValue = isVOD
        ? 'public, max-age=3600, s-maxage=3600' // VOD: 1 hour
        : 'public, max-age=15, s-maxage=15';   // Live: 15 seconds

    const cfCacheValue = isVOD ? 'max-age=3600' : 'max-age=15';

    // Optimize split/join/map by using a single loop for large manifests
    const lines = text.split('\n');
    const newLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmingLine(trimmed)) {
            try {
                let absoluteUrl = new URL(trimmed, baseUrl).href;
                if (searchParams) {
                    const separator = absoluteUrl.includes('?') ? '&' : '?';
                    absoluteUrl += separator + searchParams.replace('?', '');
                }
                const encryptedUrl = encrypt(absoluteUrl);
                newLines.push(`${origin}/api/proxy?q=${encodeURIComponent(encryptedUrl)}`);
                continue;
            } catch (e) { }
        } else if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
            const replaced = trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
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
            newLines.push(replaced);
            continue;
        }
        newLines.push(line);
    }

    const newText = newLines.join('\n');

    // Store in cache if VOD
    if (isVOD) {
        hlsCache.set(cacheKey, { content: newText, expiry: now + 3600000 }); // 1 hour cache

        // Basic cleanup for memory safety
        if (hlsCache.size > 200) {
            const firstKey = hlsCache.keys().next().value;
            if (firstKey) hlsCache.delete(firstKey);
        }
    }

    return new Response(newText, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': cacheValue,
            'Cloudflare-CDN-Cache-Control': cfCacheValue,
            'X-Proxy-Cache': 'MISS'
        }
    });
}

function trimmingLine(line: string) {
    return line && !line.startsWith('#');
}
