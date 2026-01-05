/**
 * Cloudflare Worker Proxy for Video Streaming
 * Deploy this to Cloudflare Workers to offload bandwidth from your VPS.
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const targetUrlParam = url.searchParams.get('url') || url.searchParams.get('q');

        // Simple decryption (if you use the same simple hex/base64 logic, add it here)
        // For now, assuming the worker receives the RAW target url or we implement the same decrypt logic.
        // Since 'security.server.ts' uses AES/compat logic, we might need to port it or 
        // simply trust that the client sends the right URL.
        // FOR SAFETY: You should implement a shared secret or token check here.

        if (!targetUrlParam) {
            return new Response('Missing URL', { status: 400 });
        }

        let targetUrl = targetUrlParam;

        // If the URL is encrypted (starts with http? no), handle decryption
        // NOTE: This worker example assumes the client sends the DECODED url or handles decryption before calling.
        // If you need shared decryption, copy your `decrypt` logic here.

        // HACK: If the client sends "http...", use it.
        // If it is encrypted, the worker needs the key. 

        // For this example, we assume we modify the client to send the plain URL to the worker 
        // OR the worker is set up with the same encryption key.

        // Headers construction
        const headers = new Headers();
        const unsafeHeaders = ['host', 'referer', 'origin', 'cf-ray', 'cf-connecting-ip', 'cf-visitor', 'x-forwarded-proto'];

        // Forward allowed headers
        for (const [key, value] of request.headers) {
            if (!unsafeHeaders.includes(key.toLowerCase())) {
                headers.set(key, value);
            }
        }

        // Specific Provider Logic (Mirrors proxy.ts)
        if (targetUrl.includes('mydramawave.com')) {
            headers.set('Referer', 'https://www.mydramawave.com/');
            headers.set('Origin', 'https://www.mydramawave.com');
        } else if (targetUrl.includes('farsunpteltd.com')) {
            headers.set('Token', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJfIiwiYXVkIjoiXyIsImlhdCI6MTc2NzI5NTM2OSwiZGF0YSI6eyJtZW1iZXJfaWQiOjQ1MTMwNTUwLCJwYWNrYWdlX2lkIjoiMSIsIm1haW5fcGFja2FnZV9pZCI6IjEwMCJ9fQ.U2HoYm4QEZfZ_QU9eGkzOzzQZRPGfeLKIc3qzefchQQ');
            headers.set('bundleIdentifier', 'com.farsun.shortplay');
            headers.set('Version', '2.2.2.0');
            headers.set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148');
        } else if (targetUrl.includes('netshort.com')) {
            headers.set('Referer', 'https://www.netshort.com/');
        } else if (targetUrl.includes('wolftv.online')) {
            headers.set('Referer', 'https://www.wolftv.online/');
            headers.set('Origin', 'https://www.wolftv.online');
        } else if (targetUrl.includes('tiktokcdn.com')) {
            headers.set('Referer', 'https://www.tiktok.com/');
            headers.set('Origin', 'https://www.tiktok.com');
        } else if (targetUrl.includes('shorttv.live')) {
            headers.set('Origin', 'https://www.shorttv.live');
            headers.set('Referer', 'https://www.shorttv.live/');
        } else {
            try {
                headers.set('Referer', new URL(targetUrl).origin + '/');
            } catch (e) { }
        }

        // Filter User-Agent if needed
        if (!headers.has('User-Agent')) {
            headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        }

        try {
            const response = await fetch(targetUrl, {
                method: request.method,
                headers: headers,
                redirect: 'follow'
            });

            // Cloning headers to modify them
            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            newHeaders.set('Cache-Control', 'public, max-age=31536000'); // Aggressive Caching

            // Handle M3U8 Rewrite if needed
            // (This is tricky in a worker without simple text processing, but doable)
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
                            // We just pass it as ?url=... assuming no encryption for now or client handles it
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
            return new Response('Proxy Error: ' + e.message, { status: 500 });
        }
    }
};
