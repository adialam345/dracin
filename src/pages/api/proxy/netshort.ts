import https from 'node:https';

export function handleNetShortProxy(targetUrl: string, headers: Record<string, string>): Promise<Response> {
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
            console.error(`[Proxy] NetShort HTTPS request failed:`, e.message);
            resolve(new Response(`Proxy error: ${e.message}`, { status: 500 }));
        });

        req.end();
    });
}
