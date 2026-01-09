import type { APIRoute } from 'astro';
import { encrypt, decrypt } from '../../utils/security.server';
import https from 'node:https';

export const GET: APIRoute = async ({ url, request }) => {
    let targetUrl = url.searchParams.get('url');
    const q = url.searchParams.get('q');

    if (q) {
        // Try decrypting
        const decrypted = decrypt(q);
        // Decrypt might return object or string depending on how it was encrypted.
        // If we strictly encrypt string -> string, then 'decrypted' is the url.
        // If we encrypt object {url: ...}, we need to parse.
        // Our 'encrypt' utility handles JSON.stringify.
        // So checking if it is a JSON string or raw URL.
        if (decrypted) {
            if (decrypted.startsWith('http')) {
                targetUrl = decrypted;
            } else {
                try {
                    const parsed = JSON.parse(decrypted);
                    if (parsed.url) targetUrl = parsed.url;
                    else targetUrl = decrypted; // fallback
                } catch (e) {
                    targetUrl = decrypted;
                }
            }
        }
    }

    if (!targetUrl) return new Response('Missing url', { status: 400 });

    // console.log(`[Proxy] Request received`); 

    // DEBUG: Log decrypted URL to verify it's correct
    // console.log(`[Proxy] Target URL:`, targetUrl?.substring(0, 150));

    try {
        let response;
        try {
            const headers: Record<string, string> = {
                'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...((request.headers.get('Range') && !targetUrl.includes('.m3u8')) ? { 'Range': request.headers.get('Range')! } : {})
            };

            // Forward Conditional Request Headers (Saves Bandwidth)
            if (request.headers.get('if-none-match')) headers['If-None-Match'] = request.headers.get('if-none-match')!;
            if (request.headers.get('if-modified-since')) headers['If-Modified-Since'] = request.headers.get('if-modified-since')!;

            // DramaWave Referer
            if (targetUrl.includes('mydramawave.com')) {
                headers['Referer'] = 'https://www.mydramawave.com';
            }
            // FlickReels Token (Farsun)
            else if (targetUrl.includes('farsunpteltd.com')) {
                Object.assign(headers, {
                    'Token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJfIiwiYXVkIjoiXyIsImlhdCI6MTc2NzI5NTM2OSwiZGF0YSI6eyJtZW1iZXJfaWQiOjQ1MTMwNTUwLCJwYWNrYWdlX2lkIjoiMSIsIm1haW5fcGFja2FnZV9pZCI6IjEwMCJ9fQ.U2HoYm4QEZfZ_QU9eGkzOzzQZRPGfeLKIc3qzefchQQ',
                    'bundleIdentifier': 'com.farsun.shortplay',
                    'Version': '2.2.2.0',
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
                });
            }
            // DotDrama (VividShort)
            else if (targetUrl.includes('vividshort.com')) {
                // vividshort seems to require no special headers or just standard ones, but lacks CORS on server.
                // We forward the request as is (with standard UA) and let proxy add CORS headers on response.
                headers['Origin'] = 'https://www.vividshort.com';
                headers['Referer'] = 'https://www.vividshort.com/';
            }
            // NetShort CDN - use node:https instead of fetch
            else if (targetUrl.includes('netshort.com')) {
                headers['Referer'] = 'https://www.netshort.com/';
                headers['Accept'] = '*/*';
                headers['Accept-Encoding'] = 'identity'; // Don't use compression for video

                // Use node:https for NetShort (fetch doesn't work with their CDN)
                return new Promise<Response>((resolve) => {
                    const urlObj = new URL(targetUrl);
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
            else if (targetUrl.includes('wolftv.online')) {
                headers['Referer'] = 'https://www.wolftv.online/';
                headers['Origin'] = 'https://www.wolftv.online';
            }
            // Melolo CDN (TikTok)
            else if (targetUrl.includes('tiktokcdn.com')) {
                headers['Referer'] = 'https://www.tiktok.com/';
                headers['Origin'] = 'https://www.tiktok.com';
            }
            // DramaDash (Cloudflare Stream)
            else if (targetUrl.includes('cloudflarestream.com')) {
                headers['User-Agent'] = 'DramaDash/50 CFNetwork/1474 Darwin/23.0.0';
                headers['Origin'] = 'https://dramadash.app';
                headers['Referer'] = 'https://dramadash.app/';
            }
            // ShortMax
            else if (targetUrl.includes('shorttv.live')) {
                headers['Origin'] = 'https://www.shorttv.live';
                headers['Referer'] = 'https://www.shorttv.live/';
            }
            // StardustTV
            else if (targetUrl.includes('stardusttv.cc') || targetUrl.includes('stardust-tv.com')) {
                headers['Origin'] = 'https://www.stardusttv.net';
                headers['Referer'] = 'https://www.stardusttv.net/';
            }
            // FreeShort / DramaWave Video Domain
            else if (targetUrl.includes('mydramawave.com')) {
                // IMPORTANT: DramaWave/FreeShort videos require specific Referer/Origin to avoid 403/CORS
                headers['Origin'] = 'https://www.mydramawave.com';
                headers['Referer'] = 'https://www.mydramawave.com/';
            }
            else {
                // Default Referer to origin of target (often helps with generic CDNs)
                headers['Referer'] = new URL(targetUrl).origin + '/';
            }

            response = await fetch(targetUrl, { headers });

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
            console.error(`[Proxy] Fetch failed for:`, targetUrl?.substring(0, 100), fetchError.message);
            // Return actual error message for debugging
            return new Response(`Proxy fetch error: ${fetchError.message}`, { status: 500 });
        }

        // console.log(`[Proxy] Response status: ${response.status}`);

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
            // Only trust forwarded headers if they exist, otherwise rely on request url
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
                    'Cache-Control': cacheControl
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
