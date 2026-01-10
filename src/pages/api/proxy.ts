import type { APIRoute } from 'astro';
import { decrypt } from '../../utils/security.server';
import { getProxyHeaders } from './proxy/headers';
import { handleNetShortProxy } from './proxy/netshort';
import { handleHlsRewrite } from './proxy/hls';
import { convertSrtToVtt } from './proxy/subtitles';
import { assembleProxyResponse, handle304Response } from './proxy/utils';

export const GET: APIRoute = async ({ url, request }) => {
    let targetUrl = url.searchParams.get('url');
    const q = url.searchParams.get('q');

    if (q) {
        const decrypted = decrypt(q);
        if (decrypted) {
            if (decrypted.startsWith('http')) {
                targetUrl = decrypted;
            } else {
                try {
                    const parsed = JSON.parse(decrypted);
                    if (parsed.url) targetUrl = parsed.url;
                    else targetUrl = decrypted;
                } catch (e) {
                    targetUrl = decrypted;
                }
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

        const response = await fetch(targetUrl, { headers });

        // Handle 304 Not Modified from Upstream
        if (response.status === 304) return handle304Response(response);

        const contentType = response.headers.get('content-type') || '';
        const isM3U8 = contentType.toLowerCase().includes('mpegurl') ||
            contentType.toLowerCase().includes('hls') ||
            targetUrl.includes('.m3u8');

        // Detect Origin (Handle Forwarded Headers)
        let origin = new URL(request.url).origin;
        const forwardedProto = request.headers.get('x-forwarded-proto');
        const forwardedHost = request.headers.get('x-forwarded-host');
        if (forwardedProto && forwardedHost) {
            origin = `${forwardedProto}://${forwardedHost}`;
        }

        // Handle HLS Rewriting
        if (isM3U8) {
            return handleHlsRewrite(response, targetUrl, origin);
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

