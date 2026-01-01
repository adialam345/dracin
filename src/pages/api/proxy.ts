import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, request }) => {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) return new Response('Missing url', { status: 400 });

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // 'Referer': new URL(targetUrl).origin, // Sometimes needed, sometimes harmful
            }
        });

        const contentType = response.headers.get('content-type') || '';
        console.log(`[Proxy] Fetching: ${targetUrl}`);
        console.log(`[Proxy] Content-Type: ${contentType}`);

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

        // Handle TS segments or other binary data
        const bodyBuffer = await response.arrayBuffer();

        return new Response(bodyBuffer, {
            status: response.status,
            headers: {
                'Content-Type': contentType || 'application/octet-stream',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=31536000'
            }
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
