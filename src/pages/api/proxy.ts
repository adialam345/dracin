import type { APIRoute } from 'astro';
import { encrypt, decrypt } from '../../utils/security.server';
import { PROXY_LIST } from '../../services/utils';
import https from 'node:https';
import sharp from 'sharp';

export const GET: APIRoute = async ({ url, request }) => {
    const q = url.searchParams.get('q');
    const initialurlStr = url.searchParams.get('url'); // Keep this for fallback

    // Ensure we have a target URL string
    let urlStr = '';

    if (q) {
        const decrypted = decrypt(q);
        if (decrypted) {
            if (typeof decrypted === 'string') {
                urlStr = decrypted;
            } else if (typeof decrypted === 'object') {
                urlStr = decrypted.url || decrypted.videoUrl || decrypted.posterUrl || decrypted.cover || '';
            }
        }
    }

    if (!urlStr && initialurlStr) {
        urlStr = String(initialurlStr);
    }

    // EMERGENCY FALLBACK: If q is passed but decryption failed, maybe q IS the url?
    // This happens if client sent raw URL but put it in 'q' param by mistake, 
    // or if encryption key mismatch.
    if (!urlStr && q && q.startsWith('http')) {
        urlStr = q;
    }

    urlStr = urlStr.trim();

    // Check for common URL issues
    if (urlStr.startsWith('//')) {
        urlStr = 'https:' + urlStr;
    }

    if (!urlStr || urlStr === 'null' || urlStr === 'undefined' || !urlStr.startsWith('http')) {
        console.error(`[Proxy] 400 Invalid URL. Q: ${q?.substring(0, 10)}... | Decrypted type: ${typeof decrypt(q || '')} | Str: ${urlStr}`);
        return new Response('Missing or invalid url', { status: 400 });
    }

    // console.log(`[Proxy] Request received`); 

    // DEBUG: Log decrypted URL to verify it's correct
    // console.log(`[Proxy] Target URL:`, urlStr?.substring(0, 150));

    try {
        let response;
        try {
            const headers: Record<string, string> = {
                'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...((request.headers.get('Range') && !urlStr.includes('.m3u8')) ? { 'Range': request.headers.get('Range')! } : {})
            };

            // Forward Conditional Request Headers (Saves Bandwidth)
            if (request.headers.get('if-none-match')) headers['If-None-Match'] = request.headers.get('if-none-match')!;
            if (request.headers.get('if-modified-since')) headers['If-Modified-Since'] = request.headers.get('if-modified-since')!;

            // DramaWave Referer
            if (urlStr.includes('mydramawave.com')) {
                headers['Referer'] = 'https://www.mydramawave.com';
            }
            // FlickReels Token (Farsun)
            else if (urlStr.includes('farsunpteltd.com')) {
                Object.assign(headers, {
                    'Token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJfIiwiYXVkIjoiXyIsImlhdCI6MTc2NzI5NTM2OSwiZGF0YSI6eyJtZW1iZXJfaWQiOjQ1MTMwNTUwLCJwYWNrYWdlX2lkIjoiMSIsIm1haW5fcGFja2FnZV9pZCI6IjEwMCJ9fQ.U2HoYm4QEZfZ_QU9eGkzOzzQZRPGfeLKIc3qzefchQQ',
                    'bundleIdentifier': 'com.farsun.shortplay',
                    'Version': '2.2.2.0',
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
                });
            }
            // DotDrama (VividShort)
            else if (urlStr.includes('vividshort.com')) {
                // vividshort seems to require no special headers or just standard ones, but lacks CORS on server.
                // We forward the request as is (with standard UA) and let proxy add CORS headers on response.
                headers['Origin'] = 'https://www.vividshort.com';
                headers['Referer'] = 'https://www.vividshort.com/';
            }
            // NetShort CDN - use node:https instead of fetch
            else if (urlStr.includes('netshort.com')) {
                headers['Referer'] = 'https://www.netshort.com/';
                headers['Accept'] = '*/*';
                headers['Accept-Encoding'] = 'identity'; // Don't use compression for video

                // Use node:https for NetShort (fetch doesn't work with their CDN)
                return new Promise<Response>((resolve) => {
                    const urlObj = new URL(urlStr);
                    const options: https.RequestOptions = {
                        method: 'GET',
                        headers: headers,
                        hostname: urlObj.hostname,
                        path: urlObj.pathname + urlObj.search,
                        port: 443,
                        rejectUnauthorized: false // Disable SSL verification for CDN
                    };

                    const req = https.request(options, (res) => {
                        // Handle 304 Not Modified
                        if (res.statusCode === 304) {
                            resolve(new Response(null, {
                                status: 304,
                                headers: {
                                    'Access-Control-Allow-Origin': '*',
                                    'Cache-Control': 'public, max-age=31536000',
                                    ...(res.headers['etag'] ? { 'ETag': res.headers['etag'] as string } : {}),
                                    ...(res.headers['last-modified'] ? { 'Last-Modified': res.headers['last-modified'] as string } : {})
                                }
                            }));
                            return;
                        }

                        // Stream response directly
                        const responseHeaders: Record<string, string> = {
                            'Content-Type': res.headers['content-type'] || 'video/mp4',
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'public, max-age=31536000'
                        };

                        if (res.headers['content-length']) responseHeaders['Content-Length'] = res.headers['content-length'] as string;
                        if (res.headers['content-range']) responseHeaders['Content-Range'] = res.headers['content-range'] as string;
                        if (res.headers['accept-ranges']) responseHeaders['Accept-Ranges'] = res.headers['accept-ranges'] as string;
                        if (res.headers['etag']) responseHeaders['ETag'] = res.headers['etag'] as string;
                        if (res.headers['last-modified']) responseHeaders['Last-Modified'] = res.headers['last-modified'] as string;

                        resolve(new Response(res as any, {
                            status: res.statusCode || 200,
                            headers: responseHeaders
                        }));
                    });

                    req.on('error', (e) => {
                        console.error(`[Proxy] HTTPS request failed:`, e.message);
                        resolve(new Response(`Proxy error: ${e.message}`, { status: 500 }));
                    });

                    req.end();
                });
            }
            // RadReel CDN
            else if (urlStr.includes('wolftv.online')) {
                headers['Referer'] = 'https://www.wolftv.online/';
                headers['Origin'] = 'https://www.wolftv.online';
            }
            // Melolo CDN (TikTok)
            else if (urlStr.includes('tiktokcdn.com')) {
                headers['Referer'] = 'https://www.tiktok.com/';
                headers['Origin'] = 'https://www.tiktok.com';
            }
            // DramaDash (Cloudflare Stream)
            else if (urlStr.includes('cloudflarestream.com')) {
                headers['User-Agent'] = 'DramaDash/50 CFNetwork/1474 Darwin/23.0.0';
                headers['Origin'] = 'https://dramadash.app';
                headers['Referer'] = 'https://dramadash.app/';
            }
            // ShortMax
            else if (urlStr.includes('shorttv.live')) {
                headers['Origin'] = 'https://www.shorttv.live';
                headers['Referer'] = 'https://www.shorttv.live/';
            }
            // StardustTV
            else if (urlStr.includes('stardusttv.cc') || urlStr.includes('stardust-tv.com')) {
                headers['Origin'] = 'https://www.stardusttv.net';
                headers['Referer'] = 'https://www.stardusttv.net/';
            }
            // Dramabox CDN (ksh-img)
            else if (urlStr.includes('dramabox')) {
                headers['Referer'] = 'https://www.dramaboxdb.com/';
                headers['Origin'] = 'https://www.dramaboxdb.com';
            }
            // FreeShort / DramaWave Video Domain
            else if (urlStr.includes('mydramawave.com')) {
                // IMPORTANT: DramaWave/FreeShort videos require specific Referer/Origin to avoid 403/CORS
                headers['Origin'] = 'https://www.mydramawave.com';
                headers['Referer'] = 'https://www.mydramawave.com/';
            }
            // Vigloo
            else if (urlStr.includes('vigloo.com')) {
                headers['Origin'] = 'https://www.vigloo.com';
                headers['Referer'] = 'https://www.vigloo.com/';
                headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            }
            else {
                // Default Referer to origin of target (often helps with generic CDNs)
                try {
                    const u = new URL(urlStr);
                    headers['Referer'] = u.origin + '/';
                } catch (e) {
                    // Fallback for invalid URLs or relative paths
                    headers['Referer'] = urlStr;
                }
            }

            if (q) console.log(`[Proxy] Processing: ${String(urlStr).substring(0, 60)}...`);

            const isImageRequest = urlStr.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i) || urlStr.includes('ksh-img') || urlStr.includes('img');

            const fetchWithProxy = async (url: string, proxyUrl?: string) => {
                const finalUrl = proxyUrl ? `${proxyUrl}?url=${encodeURIComponent(url)}` : url;
                return fetch(finalUrl, {
                    headers,
                    // Lower timeout for images to prevent browser queue blocking
                    signal: AbortSignal.timeout(proxyUrl ? 15000 : (isImageRequest ? 5000 : 15000))
                });
            };

            // Comprehensive Provider List for Workers
            const useWorker = urlStr.includes('dramabox') ||
                urlStr.includes('shortmax') ||
                urlStr.includes('wolftv.online') ||
                urlStr.includes('mydramawave.com') ||
                urlStr.includes('farsunpteltd.com');

            try {
                if (useWorker) {
                    // Try Worker 1, then Worker 2
                    response = await fetchWithProxy(urlStr, PROXY_LIST[0]).catch(() => fetchWithProxy(urlStr, PROXY_LIST[1]).catch(() => undefined));
                } else {
                    // Try Direct, then Worker 1
                    response = await fetchWithProxy(urlStr).catch(async () => {
                        return fetchWithProxy(urlStr, PROXY_LIST[0]).catch(() => undefined);
                    });
                }

                // Final fallback if status specifically not OK
                if (response && !response.ok && response.status !== 304) {
                    const fallbackResponse = await fetchWithProxy(urlStr, PROXY_LIST[1]).catch(() => undefined);
                    if (fallbackResponse) response = fallbackResponse;
                }
            } catch (e: any) {
                console.error(`[Proxy] Critical fetch error for ${urlStr.substring(0, 50)}: ${e.message}`);
                // Last ditch effort
                try {
                    response = await fetchWithProxy(urlStr, PROXY_LIST[0]).catch(() => undefined);
                } catch (e2) { }
            }

            if (q) console.log(`[Proxy] Result: ${response?.status || 'FAIL'} for ${urlStr.substring(0, 40)}`);

            if (!response) {
                return new Response('Proxy failed to get response', { status: 504 });
            }

            // Handle 304 Not Modified from Upstream
            if (response.status === 304) {
                return new Response(null, {
                    status: 304,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=31536000',
                        ...(response.headers.get('ETag') ? { 'ETag': response.headers.get('ETag')! } : {}),
                        ...(response.headers.get('Last-Modified') ? { 'Last-Modified': response.headers.get('Last-Modified')! } : {})
                    }
                });
            }

        } catch (fetchError: any) {
            console.error(`[Proxy] Fetch failed for:`, urlStr?.substring(0, 100), fetchError.message);
            // Return actual error message for debugging
            return new Response(`Proxy fetch error: ${fetchError.message}`, { status: 500 });
        }

        // console.log(`[Proxy] Response status: ${response.status}`);

        if (!response) {
            return new Response('Proxy failed to get response', { status: 504 });
        }

        const contentType = response.headers.get('content-type') || '';

        // For subtitle files, be more lenient with status codes
        const isSubtitle = urlStr.endsWith('.vtt') || urlStr.endsWith('.webvtt') ||
            urlStr.endsWith('.srt') || contentType.includes('vtt') ||
            contentType.includes('text/plain');

        if (!response.ok && !isSubtitle) {
            // Log the failure but don't strictly 500 images, let them pass if possible
            const isImage = contentType.startsWith('image/') || urlStr.match(/\.(jpg|jpeg|png|webp|gif)$/i);
            if (!isImage) {
                return new Response(`Proxy error status:${response.status}`, { status: 500 });
            }
        }


        // Handle M3U8 rewriting
        const isM3U8 = contentType.toLowerCase().includes('mpegurl') ||
            contentType.toLowerCase().includes('hls') ||
            urlStr.includes('.m3u8');

        if (isM3U8) {
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
                            if (existingParams.length <= 1) { // just '?'
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

        // Handle SRT subtitle conversion to VTT
        if (urlStr.endsWith('.srt') || contentType.includes('srt')) {
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
        if (urlStr.endsWith('.vtt') || urlStr.endsWith('.webvtt') || contentType.includes('vtt') || contentType.includes('text/plain')) {
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


        // Handle Image Optimization (Currently disabled to prioritize TTFB and server stability)
        const isImage = contentType.startsWith('image/') && !urlStr.endsWith('.ico');
        if (isImage) {
            return new Response(response.body, {
                status: response.status,
                headers: {
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=31536000, immutable',
                    'X-Proxy-Cache': 'Direct-Pass'
                }
            });
        }

        // Handle TS segments or other binary data

        // Fix for iOS Safari: Ensure TS segments have correct Content-Type
        let finalContentType = contentType || 'application/octet-stream';
        if (urlStr.endsWith('.ts')) {
            finalContentType = 'video/mp2t';
        }

        // Prepare headers to forward
        const headers: Record<string, string> = {
            'Content-Type': finalContentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=31536000'
        };

        if (response.headers.has('Content-Length')) headers['Content-Length'] = response.headers.get('Content-Length')!;
        if (response.headers.has('Content-Range')) headers['Content-Range'] = response.headers.get('Content-Range')!;
        if (response.headers.has('Accept-Ranges')) headers['Accept-Ranges'] = response.headers.get('Accept-Ranges')!;
        if (response.headers.has('ETag')) headers['ETag'] = response.headers.get('ETag')!;
        if (response.headers.has('Last-Modified')) headers['Last-Modified'] = response.headers.get('Last-Modified')!;

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
