/**
 * Handle image responses (pass through with CORS and caching)
 */
export function handleImage(response: Response, contentType: string): Response {
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

/**
 * Check if response is an image
 */
export function isImageResponse(contentType: string, urlStr: string): boolean {
    return contentType.startsWith('image/') && !urlStr.endsWith('.ico');
}
