import { encrypt } from '../../../../utils/security.server';

/**
 * Handle M3U8/HLS playlist responses
 * Rewrites URLs to go through proxy
 */
export async function handleM3U8(
    response: Response,
    urlStr: string,
    request: Request
): Promise<Response> {
    const text = await response.text();

    const baseUrl = new URL('.', urlStr).href;
    const urlObj = new URL(urlStr);
    const searchParams = urlObj.search;

    // Determine correct origin
    let origin = new URL(request.url).origin;
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const forwardedHost = request.headers.get('x-forwarded-host');
    if (forwardedProto && forwardedHost) {
        origin = `${forwardedProto}://${forwardedHost}`;
    }

    // Check if VOD (Video on Demand) or Live
    const isVOD = text.includes('#EXT-X-ENDLIST');
    const cacheControl = isVOD
        ? 'public, max-age=3600' // VOD: Cache for 1 hour
        : 'public, max-age=15';  // Live: Cache for 15 seconds

    const newText = text.split('\n').map((line: string) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            try {
                let absoluteUrl = new URL(trimmed, baseUrl).href;
                // Append original query params if not already present
                if (searchParams && !absoluteUrl.includes('?')) {
                    absoluteUrl += searchParams;
                } else if (searchParams && absoluteUrl.includes('?')) {
                    // Merge params carefully
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
            'Cache-Control': cacheControl
        }
    });
}

/**
 * Check if response is M3U8
 */
export function isM3U8Response(contentType: string, urlStr: string): boolean {
    return contentType.toLowerCase().includes('mpegurl') ||
        contentType.toLowerCase().includes('hls') ||
        urlStr.includes('.m3u8');
}
