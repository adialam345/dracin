import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, request }) => {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) return new Response('Missing url', { status: 400 });

    console.log(`[Proxy] Request received for: ${targetUrl.substring(0, 100)}...`);

    try {
        let response;
        try {
            response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    ...((request.headers.get('Range') && !targetUrl.includes('.m3u8')) ? { 'Range': request.headers.get('Range')! } : {}),
                    // 'Referer': new URL(targetUrl).origin, // Sometimes needed, sometimes harmful
                    ...(targetUrl.includes('farsunpteltd.com') ? {
                        'Token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJfIiwiYXVkIjoiXyIsImlhdCI6MTc2NzI5NTM2OSwiZGF0YSI6eyJtZW1iZXJfaWQiOjQ1MTMwNTUwLCJwYWNrYWdlX2lkIjoiMSIsIm1haW5fcGFja2FnZV9pZCI6IjEwMCJ9fQ.U2HoYm4QEZfZ_QU9eGkzOzzQZRPGfeLKIc3qzefchQQ',
                        'bundleIdentifier': 'com.farsun.shortplay',
                        'Version': '2.2.2.0'
                    } : {})
                }
            });
        } catch (fetchError: any) {
            console.error(`[Proxy] Fetch failed:`, fetchError);
            return new Response(`Proxy fetch error: ${fetchError.message}`, { status: 500 });
        }

        console.log(`[Proxy] Fetching: ${targetUrl}`);
        console.log(`[Proxy] Response status: ${response.status} ${response.statusText}`);

        const contentType = response.headers.get('content-type') || '';
        console.log(`[Proxy] Content-Type: ${contentType}`);

        // For subtitle files, be more lenient with status codes
        const isSubtitle = targetUrl.endsWith('.vtt') || targetUrl.endsWith('.webvtt') ||
            targetUrl.endsWith('.srt') || contentType.includes('vtt') ||
            contentType.includes('text/plain');

        if (!response.ok && !isSubtitle) {
            console.error(`[Proxy] Failed to fetch: ${response.status} ${response.statusText}`);
            return new Response(`Proxy error status:${response.status} statusText:${response.statusText}`, { status: 500 });
        }


        // Handle M3U8 rewriting
        const isM3U8 = contentType.toLowerCase().includes('mpegurl') ||
            contentType.toLowerCase().includes('hls') ||
            targetUrl.includes('.m3u8');

        if (isM3U8) {
            const text = await response.text();
            const baseUrl = new URL('.', targetUrl).href;
            const origin = new URL(request.url).origin;

            const newText = text.split('\n').map(line => {
                const trimmed = line.trim();
                // If line is a URL (not starting with # and not empty)
                if (trimmed && !trimmed.startsWith('#')) {
                    // Resolve absolute URL
                    try {
                        const absoluteUrl = new URL(trimmed, baseUrl).href;
                        return `${origin}/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                    } catch (e) {
                        return line; // Fallback
                    }
                }
                // Handle URI in tags (EXT-X-KEY, EXT-X-MEDIA, etc.)
                if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
                    return trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
                        try {
                            const absoluteUrl = new URL(uri, baseUrl).href;
                            return `URI="${origin}/api/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
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
