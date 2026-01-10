/**
 * Cloudflare Worker Proxy for Video Streaming
 * Deploy this to Cloudflare Workers to offload bandwidth from your VPS.
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Max-Age': '86400',
                }
            });
        }

        const targetUrlParam = url.searchParams.get('url') || url.searchParams.get('q');

        if (!targetUrlParam) {
            return new Response('Missing URL', {
                status: 400,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        let targetUrl = targetUrlParam;

        // Headers construction
        const headers = new Headers();
        const unsafeHeaders = ['host', 'referer', 'origin', 'cf-ray', 'cf-connecting-ip', 'cf-visitor', 'x-forwarded-proto'];

        // Forward allowed headers
        for (const [key, value] of request.headers) {
            if (!unsafeHeaders.includes(key.toLowerCase())) {
                headers.set(key, value);
            }
        }

        // Specific Provider Logic
        if (targetUrl.includes('mydramawave.com')) {
            headers.set('Referer', 'https://www.mydramawave.com/');
            headers.set('Origin', 'https://www.mydramawave.com');
        } else if (targetUrl.includes('farsunpteltd.com')) {
            headers.set('Token', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJfIiwiYXVkIjoiXyIsImlhdCI6MTc2NzI5NTM2OSwiZGF0YSI6eyJtZW1iZXJfaWQiOjQ1MTMwNTUwLCJwYWNrYWdlX2lkIjoiMSIsIm1haW5fcGFja2FnZV9pZCI6IjEwMCJ9fQ.U2HoYm4QEZfZ_QU9eGkzOzzQZRPGfeLKIc3qzefchQQ');
            headers.set('bundleIdentifier', 'com.farsun.shortplay');
            headers.set('Version', '2.2.2.0');
            headers.set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148');
        } else if (targetUrl.includes('vividshort.com')) {
            headers.set('Origin', 'https://www.vividshort.com');
            headers.set('Referer', 'https://www.vividshort.com/');
        } else if (targetUrl.includes('netshort.com')) {
            headers.set('Referer', 'https://www.netshort.com/');
            headers.set('Accept', '*/*');
            headers.set('Accept-Encoding', 'identity');
        } else if (targetUrl.includes('wolftv.online')) {
            headers.set('Referer', 'https://www.wolftv.online/');
            headers.set('Origin', 'https://www.wolftv.online');
        } else if (targetUrl.includes('tiktokcdn.com')) {
            headers.set('Referer', 'https://www.tiktok.com/');
            headers.set('Origin', 'https://www.tiktok.com');
        } else if (targetUrl.includes('cloudflarestream.com')) {
            headers.set('User-Agent', 'DramaDash/50 CFNetwork/1474 Darwin/23.0.0');
            headers.set('Origin', 'https://dramadash.app');
            headers.set('Referer', 'https://dramadash.app/');
        } else if (targetUrl.includes('shorttv.live')) {
            headers.set('Origin', 'https://www.shorttv.live');
            headers.set('Referer', 'https://www.shorttv.live/');
        } else if (targetUrl.includes('stardusttv.cc') || targetUrl.includes('stardust-tv.com')) {
            headers.set('Origin', 'https://www.stardusttv.net');
            headers.set('Referer', 'https://www.stardusttv.net/');
        } else if (targetUrl.includes('vigloo.com')) {
            headers.set('Origin', 'https://www.vigloo.com');
            headers.set('Referer', 'https://www.vigloo.com/');
            headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        } else if (targetUrl.includes('dramaboxdb.com')) {
            headers.set('Origin', 'https://www.dramabox.com');
            headers.set('Referer', 'https://www.dramabox.com/');
        } else {
            try {
                headers.set('Referer', new URL(targetUrl).origin + '/');
            } catch (e) { }
        }

        if (!headers.has('User-Agent')) {
            headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        }

        try {
            const response = await fetch(targetUrl, {
                method: request.method,
                headers: headers,
                redirect: 'follow',
            });

            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
            newHeaders.set('Access-Control-Allow-Headers', '*');

            // If it's a 429, we still want to pass it through with CORS headers
            if (response.status === 429) {
                return new Response(response.body, {
                    status: 429,
                    headers: newHeaders
                });
            }

            newHeaders.set('Cache-Control', 'public, max-age=31536000');

            const contentType = newHeaders.get('content-type') || '';
            if (contentType.includes('mpegurl') || contentType.includes('hls') || targetUrl.includes('.m3u8')) {
                const text = await response.text();
                const baseUrl = new URL('.', targetUrl).href;
                const workerOrigin = new URL(request.url).origin;

                const newText = text.split('\n').map(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        try {
                            const absUrl = new URL(trimmed, baseUrl).href;
                            return `${workerOrigin}/?url=${encodeURIComponent(absUrl)}`;
                        } catch (e) { return line; }
                    }
                    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
                        return trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
                            try {
                                const absUrl = new URL(uri, baseUrl).href;
                                return `URI="${workerOrigin}/?url=${encodeURIComponent(absUrl)}"`;
                            } catch (e) { return match; }
                        });
                    }
                    return line;
                }).join('\n');

                return new Response(newText, {
                    status: 200,
                    headers: newHeaders
                });
            }

            return new Response(response.body, {
                status: response.status,
                headers: newHeaders
            });

        } catch (e) {
            console.error('Proxy Error:', {
                message: e.message,
                targetUrl: targetUrl,
                stack: e.stack
            });

            return new Response(JSON.stringify({
                error: 'Proxy Error',
                message: e.message,
                targetUrl: targetUrl,
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
                    'Access-Control-Allow-Headers': '*',
                }
            });
        }
    }

};
