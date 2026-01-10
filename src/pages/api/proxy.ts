import type { APIRoute } from 'astro';
import { parseTargetUrl } from './proxy/url-parser';
import { buildHeaders, isNetShortUrl } from './proxy/headers';
import { fetchWithFallback, isImageRequest } from './proxy/fetcher';
import {
    handleNetShort,
    handleM3U8, isM3U8Response,
    handleSRT, handleVTT, isSRTSubtitle, isVTTSubtitle, isSubtitle,
    handleImage, isImageResponse,
    handleVideo
} from './proxy/handlers';

export const GET: APIRoute = async ({ url, request }) => {
    // Parse and validate target URL
    const { urlStr, error } = parseTargetUrl(url);
    if (error) return error;

    const q = url.searchParams.get('q');
    if (q) console.log(`[Proxy] Processing: ${urlStr.substring(0, 60)}...`);

    try {
        // Build headers based on provider
        const headers = buildHeaders(urlStr, request);

        // Special handling for NetShort CDN
        if (isNetShortUrl(urlStr)) {
            return handleNetShort(urlStr, headers);
        }

        // Fetch with proxy fallback strategy
        const isImage = isImageRequest(urlStr);
        const { response } = await fetchWithFallback(urlStr, headers, isImage);

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

        const contentType = response.headers.get('content-type') || '';

        // Check response status
        const isSubtitleRequest = isSubtitle(urlStr, contentType);
        if (!response.ok && !isSubtitleRequest) {
            const isImageResp = contentType.startsWith('image/') || urlStr.match(/\.(jpg|jpeg|png|webp|gif)$/i);
            if (!isImageResp) {
                const errText = await response.text().catch(() => '');
                console.error(`[Proxy] Upstream Error ${response.status} for ${urlStr.substring(0, 50)}: ${errText.substring(0, 200)}`);
                return new Response(`Proxy upstream error: ${response.status} - ${errText.substring(0, 100)}`, {
                    status: response.status >= 500 ? 502 : response.status
                });
            }
        }

        // Route to appropriate handler based on content type/URL

        // M3U8/HLS handling
        if (isM3U8Response(contentType, urlStr)) {
            return handleM3U8(response, urlStr, request);
        }

        // SRT to VTT conversion
        if (isSRTSubtitle(urlStr, contentType)) {
            return handleSRT(response);
        }

        // VTT passthrough
        if (isVTTSubtitle(urlStr, contentType)) {
            return handleVTT(response);
        }

        // Image handling
        if (isImageResponse(contentType, urlStr)) {
            return handleImage(response, contentType);
        }

        // Default: Video/Binary handling
        return handleVideo(response, urlStr, contentType);

    } catch (e) {
        console.error('Proxy error:', e);
        return new Response('Proxy error', { status: 500 });
    }
};
