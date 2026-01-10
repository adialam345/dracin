export function assembleProxyResponse(response: Response, targetUrl: string): Response {
    const contentType = response.headers.get('content-type') || '';

    // Fix for iOS Safari: Ensure TS segments have correct Content-Type
    let finalContentType = contentType || 'application/octet-stream';
    if (targetUrl.toLowerCase().endsWith('.ts')) {
        finalContentType = 'video/mp2t';
    }

    // Prepare headers to forward
    const headers: Record<string, string> = {
        'Content-Type': finalContentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000',
        'Cloudflare-CDN-Cache-Control': 'max-age=31536000'
    };

    const keysToForward = ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified'];
    keysToForward.forEach(key => {
        if (response.headers.has(key)) {
            headers[key] = response.headers.get(key)!;
        }
    });

    return new Response(response.body, {
        status: response.status,
        headers: headers
    });
}

export function handle304Response(response: Response): Response {
    return new Response(null, {
        status: 304,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=31536000, s-maxage=31536000',
            'Cloudflare-CDN-Cache-Control': 'max-age=31536000',
            ...(response.headers.get('ETag') ? { 'ETag': response.headers.get('ETag')! } : {}),
            ...(response.headers.get('Last-Modified') ? { 'Last-Modified': response.headers.get('Last-Modified')! } : {})
        }
    });
}
