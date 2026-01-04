/**
 * Cloudflare Worker - API Proxy
 * Deploy this to Cloudflare Workers to bypass IP blocking
 * 
 * Instructions:
 * 1. Go to https://dash.cloudflare.com/
 * 2. Click "Workers & Pages" in sidebar
 * 3. Click "Create application" -> "Create Worker"
 * 4. Name it something like "api-proxy"
 * 5. Replace the code with this file's content
 * 6. Click "Save and Deploy"
 * 7. Note the URL (e.g., https://api-proxy.YOUR_SUBDOMAIN.workers.dev)
 * 8. Update WORKER_URL in utils.ts with that URL
 */

export default {
    async fetch(request) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        const url = new URL(request.url);

        // Get target URL from query param
        const targetUrl = url.searchParams.get('url');

        if (!targetUrl) {
            return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        try {
            // Forward request to target API with browser-like headers
            const response = await fetch(targetUrl, {
                method: request.method,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                    'Referer': 'https://sansekai.my.id/',
                    'Origin': 'https://sansekai.my.id',
                },
            });

            // Get response body
            const body = await response.text();

            // Return response with CORS headers
            return new Response(body, {
                status: response.status,
                headers: {
                    'Content-Type': response.headers.get('Content-Type') || 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=300', // Cache for 5 min
                },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
    },
};
