import { encrypt } from '../../../utils/security.server';

export async function handleHlsRewrite(response: Response, targetUrl: string, origin: string): Promise<Response> {
    const text = await response.text();
    const baseUrl = new URL('.', targetUrl).href;
    const urlObj = new URL(targetUrl);
    const searchParams = urlObj.search;

    const isVOD = text.includes('#EXT-X-ENDLIST');
    const cacheValue = isVOD
        ? 'public, max-age=3600, s-maxage=3600' // VOD: 1 hour
        : 'public, max-age=15, s-maxage=15';   // Live: 15 seconds

    const cfCacheValue = isVOD ? 'max-age=3600' : 'max-age=15';

    const newText = text.split('\n').map((line: string) => {
        const trimmed = line.trim();
        if (trimmingLine(trimmed)) {
            try {
                let absoluteUrl = new URL(trimmed, baseUrl).href;
                if (searchParams && !absoluteUrl.includes('?')) {
                    absoluteUrl += searchParams;
                } else if (searchParams && absoluteUrl.includes('?')) {
                    const existingParams = new URL(absoluteUrl).search;
                    if (existingParams.length <= 1) {
                        absoluteUrl += searchParams.replace('?', '');
                    } else {
                        absoluteUrl += '&' + searchParams.replace('?', '');
                    }
                }
                const encryptedUrl = encrypt(absoluteUrl);
                return `${origin}/api/proxy?q=${encodeURIComponent(encryptedUrl)}`;
            } catch (e) {
                return line;
            }
        }
        if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
                try {
                    let absoluteUrl = new URL(uri, baseUrl).href;
                    if (searchParams && !absoluteUrl.includes('?')) {
                        absoluteUrl += searchParams;
                    }
                    const encryptedUrl = encrypt(absoluteUrl);
                    return `URI="${origin}/api/proxy?q=${encodeURIComponent(encryptedUrl)}"`;
                } catch (e) {
                    return match;
                }
            });
        }
        return line;
    }).join('\n');

    return new Response(newText, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': cacheValue,
            'Cloudflare-CDN-Cache-Control': cfCacheValue
        }
    });
}

function trimmingLine(line: string) {
    return line && !line.startsWith('#');
}
