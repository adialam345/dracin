import type { APIRoute } from 'astro';
import { encrypt, decrypt } from '../../utils/security';

export const GET: APIRoute = async ({ url, request }) => {
    let targetUrl = url.searchParams.get('url');
    const q = url.searchParams.get('q');

    if (q) {
        // Try decrypting
        // Decode URI component just in case browsers/servers double encode the base64 symbols
        const decrypted = decrypt(decodeURIComponent(q)) || decrypt(q);

        console.log('[Proxy] Decrypted payload:', decrypted ? (typeof decrypted === 'string' ? decrypted.substring(0, 100) : JSON.stringify(decrypted).substring(0, 100)) : 'NULL');

        // Decrypt might return object or string depending on how it was encrypted.
        // If we strictly encrypt string -> string, then 'decrypted' is the url.
        // If we encrypt object {url: ...}, we need to parse.
        // Our 'encrypt' utility handles JSON.stringify.
        // So checking if it is a JSON string or raw URL.
        if (decrypted) {
            if (typeof decrypted === 'string' && decrypted.startsWith('http')) {
                targetUrl = decrypted;
            } else if (typeof decrypted === 'object') {
                // Already parsed object
                targetUrl = decrypted.videoUrl || decrypted.url || null;
            } else if (typeof decrypted === 'string') {
                try {
                    const parsed = JSON.parse(decrypted);
                    // Handle both {videoUrl: '...'} (VideoPlayer prop) and {url: '...'} (potential other cases)
                    targetUrl = parsed.videoUrl || parsed.url || decrypted;
                } catch (e) {
                    targetUrl = decrypted;
                }
            }
        }
    }

    if (!targetUrl) {
        console.error('[Proxy] No target URL after decryption');
        return new Response('Missing url', { status: 400 });
    }

    console.log(`[Proxy] Target URL: ${targetUrl.substring(0, 150)}...`);

    try {
        let response;
        try {
            const headers: Record<string, string> = {
                'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...((request.headers.get('Range') && !targetUrl.includes('.m3u8')) ? { 'Range': request.headers.get('Range')! } : {})
            };

            // DramaWave Referer
            if (targetUrl.includes('mydramawave.com')) {
                headers['Referer'] = 'https://www.mydramawave.com/';
                headers['Origin'] = 'https://www.mydramawave.com';
            }
            // FlickReels Token (Farsun)
            else if (targetUrl.includes('farsunpteltd.com')) {
                Object.assign(headers, {
                    'Token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJfIiwiYXVkIjoiXyIsImlhdCI6MTc2NzI5NTM2OSwiZGF0YSI6eyJtZW1iZXJfaWQiOjQ1MTMwNTUwLCJwYWNrYWdlX2lkIjoiMSIsIm1haW5fcGFja2FnZV9pZCI6IjEwMCJ9fQ.U2HoYm4QEZfZ_QU9eGkzOzzQZRPGfeLKIc3qzefchQQ',
                    'bundleIdentifier': 'com.farsun.shortplay',
                    'Version': '2.2.2.0'
                });
            } else {
                // Default Referer to origin of target (often helps with generic CDNs)
                try {
                    headers['Referer'] = new URL(targetUrl).origin + '/';
                } catch (e) {
                    // Invalid URL, skip referer
                }
            }

            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            try {
                response = await fetch(targetUrl, {
                    headers,
                    signal: controller.signal,
                    // @ts-ignore - some environments support these
                    redirect: 'follow',
                    keepalive: false
                });
                clearTimeout(timeoutId);
            } catch (err) {
                clearTimeout(timeoutId);
                throw err;
            }

        } catch (fetchError: any) {
            console.error(`[Proxy] Fetch failed for URL:`, targetUrl);
            console.error(`[Proxy] Error details:`, fetchError);
            console.error(`[Proxy] Error stack:`, fetchError.stack);

            // Provide more specific error messages
            let errorMsg = fetchError.message;
            if (fetchError.name === 'AbortError') {
                errorMsg = 'Request timeout (30s)';
            } else if (errorMsg.includes('fetch failed')) {
                errorMsg = 'Network error - CDN may be blocking server requests';
            }

            // Return actual error message for debugging
            return new Response(`Proxy fetch error: ${errorMsg} | URL: ${targetUrl.substring(0, 100)}`, { status: 500 });
        }

        console.log(`[Proxy] Response status: ${response.status}`);

        const contentType = response.headers.get('content-type') || '';

        // For subtitle files, be more lenient with status codes
        const isSubtitle = targetUrl.endsWith('.vtt') || targetUrl.endsWith('.webvtt') ||
            targetUrl.endsWith('.srt') || contentType.includes('vtt') ||
            contentType.includes('text/plain');

        if (!response.ok && !isSubtitle) {
            return new Response(`Proxy error status:${response.status}`, { status: 500 });
        }


        // Handle M3U8 rewriting
        const isM3U8 = contentType.toLowerCase().includes('mpegurl') ||
            contentType.toLowerCase().includes('hls') ||
            targetUrl.includes('.m3u8');

        if (isM3U8) {
            const text = await response.text();
            const baseUrl = new URL('.', targetUrl).href;

            // Determine correct origin (handling reverse proxies)
            let origin = new URL(request.url).origin;
            const protocol = request.headers.get('x-forwarded-proto') || 'https';
            const host = request.headers.get('x-forwarded-host') || request.headers.get('host');

            if (host) {
                origin = `${protocol}://${host}`;
            }

            const newText = text.split('\n').map(line => {
                const trimmed = line.trim();
                // If line is a URL (not starting with # and not empty)
                if (trimmed && !trimmed.startsWith('#')) {
                    // Resolve absolute URL
                    try {
                        const absoluteUrl = new URL(trimmed, baseUrl).href;
                        const encryptedUrl = encrypt(absoluteUrl); // Encrypt the URL for the next segment
                        return `${origin}/api/proxy?q=${encodeURIComponent(encryptedUrl)}`;
                    } catch (e) {
                        return line; // Fallback
                    }
                }
                // Handle URI in tags (EXT-X-KEY, EXT-X-MEDIA, etc.)
                if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
                    return trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
                        try {
                            const absoluteUrl = new URL(uri, baseUrl).href;
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
                }
            });
        }

        // Handle SRT subtitle conversion to VTT
        if (targetUrl.endsWith('.srt') || contentType.includes('srt')) {
            const srtText = await response.text();
            const vttText = convertSrtToVtt(srtText);

            return new Response(vttText, {
                status: 200,
                headers: {
                    'Content-Type': 'text/vtt',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=31536000'
                }
            });
        }

        // Handle WebVTT subtitles (pass through with CORS headers)
        if (targetUrl.endsWith('.vtt') || targetUrl.endsWith('.webvtt') || contentType.includes('vtt') || contentType.includes('text/plain')) {
            const vttText = await response.text();

            return new Response(vttText, {
                status: 200,
                headers: {
                    'Content-Type': 'text/vtt',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=31536000'
                }
            });
        }


        // Handle TS segments or other binary data
        // Stream the response body directly to avoid buffering large files in memory

        // Fix for iOS Safari: Ensure TS segments have correct Content-Type
        let finalContentType = contentType || 'application/octet-stream';
        if (targetUrl.endsWith('.ts')) {
            finalContentType = 'video/mp2t';
        }

        // Prepare headers to forward
        const headers: Record<string, string> = {
            'Content-Type': finalContentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=31536000'
        };

        if (response.headers.has('Content-Length')) {
            headers['Content-Length'] = response.headers.get('Content-Length')!;
        }
        if (response.headers.has('Content-Range')) {
            headers['Content-Range'] = response.headers.get('Content-Range')!;
        }
        if (response.headers.has('Accept-Ranges')) {
            headers['Accept-Ranges'] = response.headers.get('Accept-Ranges')!;
        }

        return new Response(response.body, {
            status: response.status,
            headers: headers
        });
    } catch (e) {
        console.error('Proxy error:', e);
        return new Response('Proxy error', { status: 500 });
    }
};

// Helper function to convert SRT to VTT
function convertSrtToVtt(srt: string): string {
    // Add WEBVTT header
    let vtt = 'WEBVTT\n\n';

    // Replace comma with dot in timestamps (SRT uses comma, VTT uses dot)
    // SRT format: 00:00:01,000 --> 00:00:04,000
    // VTT format: 00:00:01.000 --> 00:00:04.000
    vtt += srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

    return vtt;
}
