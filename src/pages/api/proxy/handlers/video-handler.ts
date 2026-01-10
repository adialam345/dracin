/**
 * Handle video/binary responses (TS segments, MP4, etc.)
 */
export function handleVideo(response: Response, urlStr: string, contentType: string): Response {
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
}
