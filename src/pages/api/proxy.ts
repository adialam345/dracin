import type { APIRoute } from 'astro';
import { decrypt } from '../../utils/security.server';
import { getProxyHeaders } from './proxy/headers';
import { handleNetShortProxy } from './proxy/netshort';
import { handleHlsRewrite } from './proxy/hls';
import { convertSrtToVtt } from './proxy/subtitles';
import { assembleProxyResponse, handle304Response } from './proxy/utils';
import { PROXY_LIST, DEAD_PROXIES } from '../../services/utils';

export const GET: APIRoute = async ({ url, request }) => {
    let targetUrl = url.searchParams.get('url');
    const q = url.searchParams.get('q');

    if (q) {
        const decrypted = decrypt(q);
        if (decrypted) {
            if (typeof decrypted === 'string' && decrypted.startsWith('http')) {
                targetUrl = decrypted;
            } else if (typeof decrypted === 'object' && decrypted.url) {
                targetUrl = decrypted.url;
            } else {
                targetUrl = typeof decrypted === 'string' ? decrypted : null;
            }
        }
    }

    if (!targetUrl) return new Response('Missing url', { status: 400 });

    try {
        const headers = getProxyHeaders(targetUrl, request.headers);

        // Special handling for NetShort (uses node:https for stability)
        if (targetUrl.includes('netshort.com')) {
            return handleNetShortProxy(targetUrl, headers);
        }

        // Smart Failover Logic
        let response: Response | null = null;
        let lastError: any = null;
        const maxRetries = 5;

        // Extract the true origin if the targetUrl is already a worker
        let originUrl = targetUrl;
        const targetIsWorker = PROXY_LIST.some(p => targetUrl?.startsWith(p));

        if (targetIsWorker) {
            try {
                const parsed = new URL(targetUrl);
                const embeddedUrl = parsed.searchParams.get('url');
                if (embeddedUrl) originUrl = embeddedUrl;
            } catch (e) { }
        }

        // Available proxies cache for this request
        let availableProxies = PROXY_LIST.filter(p => !DEAD_PROXIES.has(p));
        if (availableProxies.length === 0) availableProxies = [...PROXY_LIST];

        for (let i = 0; i < maxRetries; i++) {
            let currentRequestUrl = originUrl;
            let currentProxy: string | null = null;

            // Decision: Use proxy or direct?
            // If targetUrl WAS a worker, we definitely want to use a proxy (originUrl might be blocked).
            // Or if we failed previously.
            // If i > 0, we definitely use a proxy to retry.
            if (targetIsWorker || i > 0) {
                if (availableProxies.length === 0) {
                    // Emergency reset if all exhausted during retries
                    availableProxies = [...PROXY_LIST];
                }
                // Pick random proxy
                currentProxy = availableProxies[Math.floor(Math.random() * availableProxies.length)];
                currentRequestUrl = `${currentProxy}?url=${encodeURIComponent(originUrl)}`;
            }

            try {
                const res = await fetch(currentRequestUrl, { headers });

                // Check for Success
                if (res.ok || res.status === 304 || res.status === 206) {
                    response = res;
                    break;
                }

                // Check for Cloudflare/Worker Limits
                // 529: Overloaded / Rate Limited
                // 503: Service Unavailable (sometimes Worker limit)
                // 429: Too Many Requests
                // 1015/1027: Cloudflare specific errors often in body, but status might be 4xx/5xx
                // We also check headers if available
                const isLimit = res.status === 529 || res.status === 429 || res.status === 503;

                // If it's a limit and we used a proxy (or target was a proxy), mark it dead
                if (isLimit) {
                    if (currentProxy) {
                        console.warn(`[Proxy API] Worker blocked/limited: ${currentProxy}. Status: ${res.status}`);
                        DEAD_PROXIES.add(currentProxy);
                        // Remove from current available list for next iteration
                        availableProxies = availableProxies.filter(p => p !== currentProxy);
                    } else if (targetIsWorker) {
                        // The original target was a worker and it failed. Mark it dead.
                        // We can't know exactly which one unless we parse targetUrl, but we did that check earlier.
                        // Actually 'targetIsWorker' just means originUrl was extracted. 
                        // But if i=0 and targetIsWorker is true, we tried `originUrl`? No, logic above says:
                        // "if (targetIsWorker || i > 0)" -> use proxy.
                        // So if targetIsWorker is true, we used 'currentProxy'.
                    }

                    // Continue to next retry
                    continue;
                }

                // If it's a hard 403 (Client Blocked) from Origin?
                // If we went direct (i=0, not worker), and got 403, we should retry with Proxy.
                if (res.status === 403 && !currentProxy) {
                    console.warn(`[Proxy API] Direct fetch 403 forbidden. Retrying with Worker.`);
                    continue;
                }

                // If it is 500 error from Proxy itself (Worker threw exception)
                if (res.status === 500 && currentProxy) {
                    // Check body for "Worker threw exception" if possible? 
                    // But we want to stream. Reading body consumes it.
                    // Risk: If we read body and it's NOT a worker error, we can't stream it to client easily?
                    // Unless we clone?
                    try {
                        const clone = res.clone();
                        const text = await clone.text();
                        if (text.includes('Worker threw exception') || text.includes('1027') || text.includes('1015')) {
                            DEAD_PROXIES.add(currentProxy);
                            availableProxies = availableProxies.filter(p => p !== currentProxy);
                            continue;
                        }
                    } catch (err) { }
                }

                // If other error, break and return (unless we want to be aggressive)
                response = res;
                break;

            } catch (err) {
                console.error(`Attempt ${i + 1} failed:`, err);
                lastError = err;
                if (i === maxRetries - 1) break;
                // Wait small delay?
                await new Promise(r => setTimeout(r, 200));
            }
        }

        if (!response) {
            return new Response(`Proxy failed after retries. Last error: ${lastError}`, { status: 502 });
        }

        // --- Processing Logic (Same as before) ---

        // Handle 304 Not Modified from Upstream
        if (response.status === 304) return handle304Response(response);

        const contentType = response.headers.get('content-type') || '';
        const isM3U8 = contentType.toLowerCase().includes('mpegurl') ||
            contentType.toLowerCase().includes('hls') ||
            targetUrl.includes('.m3u8'); // Use targetUrl (original intention) or originUrl? standard proxy uses targetUrl usually.

        // Detect Origin (Handle Forwarded Headers)
        let origin = new URL(request.url).origin;
        const forwardedProto = request.headers.get('x-forwarded-proto');
        const forwardedHost = request.headers.get('x-forwarded-host');
        if (forwardedProto && forwardedHost) {
            origin = `${forwardedProto}://${forwardedHost}`;
        }

        // Handle HLS Rewriting
        if (isM3U8) {
            // Note: targetUrl is used for resolving relative paths in M3U8. 
            // If we used a proxy, M3U8 content might be from originUrl.
            // But handleHlsRewrite uses targetUrl to resolve. 
            // If currentRequestUrl was proxy... 
            // We should pass originUrl if we unwrapped it.
            return handleHlsRewrite(response, originUrl, origin);
        }

        // Handle SRT to VTT Conversion
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

        // Handle WebVTT Pass-through
        const isSubtitle = targetUrl.endsWith('.vtt') || targetUrl.endsWith('.webvtt') ||
            contentType.includes('vtt') || (contentType.includes('text/plain') && (targetUrl.includes('vtt') || targetUrl.includes('srt')));

        if (isSubtitle) {
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

        // Default Response Assembly (Binary/Generic data)
        if (!response.ok) {
            return new Response(`Proxy error status:${response.status}`, { status: 500 });
        }

        return assembleProxyResponse(response, targetUrl);

    } catch (e) {
        console.error('Proxy error:', e);
        return new Response('Proxy error', { status: 500 });
    }
};
