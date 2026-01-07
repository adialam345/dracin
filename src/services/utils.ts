import dns from 'node:dns';
import https from 'node:https';
import zlib from 'node:zlib';

// Force IPv4 to avoid ECONNRESET on some hosting providers where IPv6 is flaky
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

export const API_BASE = 'https://api.sansekai.my.id/api';

const WORKER_URL = process.env.PROXY_URL || 'https://vercel-proxy-adialam345s-projects.vercel.app/api';
// Example proxies:
// const WORKER_URL = 'https://your-vercel-proxy.vercel.app/api?url=';


// Simple in-memory cache for server-side requests
const serverCache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function withCache<T>(key: string, fetcher: () => Promise<T>, ttl: number = CACHE_TTL): Promise<T> {
    const cached = serverCache.get(key);
    if (cached && cached.expiry > Date.now()) {
        return cached.data;
    }

    try {
        const data = await fetcher();
        // Only cache if data is valid (truthy and not empty array if it's an array)
        const isValid = data && (!Array.isArray(data) || data.length > 0);
        if (isValid) {
            serverCache.set(key, { data, expiry: Date.now() + ttl });
        }
        return data;
    } catch (e) {
        console.error(`[Cache] Error fetching ${key}:`, e);
        throw e;
    }
}

// Global state to handle rate limiting
let globalBackoffuntil = 0;

// Custom HTTPS agent with better connection handling
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 3000,
    timeout: 30000,
    rejectUnauthorized: true,
    family: 4
});

/**
 * Make HTTPS request using node:https instead of fetch (more reliable on some hosts)
 */
function httpsRequest(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        const options: https.RequestOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            agent: httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...(url.includes('api.sansekai.my.id') ? {
                    'Referer': 'https://sansekai.my.id/',
                    'Origin': 'https://sansekai.my.id'
                } : {})
            },
            timeout: 8000
        };

        const req = https.request(options, (res) => {
            const chunks: Buffer[] = [];

            // Handle compressed responses
            let stream: NodeJS.ReadableStream = res;
            const encoding = res.headers['content-encoding'];

            if (encoding === 'gzip') {
                stream = res.pipe(zlib.createGunzip());
            } else if (encoding === 'deflate') {
                stream = res.pipe(zlib.createInflate());
            } else if (encoding === 'br') {
                stream = res.pipe(zlib.createBrotliDecompress());
            }

            stream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            stream.on('end', () => {
                const data = Buffer.concat(chunks).toString('utf8');
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else if (res.statusCode === 429) {
                    reject(new Error('RATE_LIMITED'));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });

            stream.on('error', (e) => {
                reject(e);
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

export async function fetchCached(url: string, retries: number = 3): Promise<any> {
    const cached = serverCache.get(url);
    if (cached && cached.expiry > Date.now()) {
        return cached.data;
    }

    const data = await fetchFromEndpoint(url, retries);
    // Only cache successful, non-empty results
    if (data && (!Array.isArray(data) || data.length > 0)) {
        serverCache.set(url, { data, expiry: Date.now() + CACHE_TTL });
    }
    return data;
}

export async function fetchFromEndpoint(url: string, retries: number = 3, delay: number = 300): Promise<any> {
    for (let i = 0; i < retries; i++) {
        const now = Date.now();
        if (now < globalBackoffuntil) {
            await new Promise(resolve => setTimeout(resolve, globalBackoffuntil - now));
        }

        try {
            // Route through Cloudflare Worker if configured, otherwise use direct connection
            const targetUrl = WORKER_URL
                ? `${WORKER_URL}?url=${encodeURIComponent(url)}`
                : url;

            const text = await httpsRequest(targetUrl);
            const data = JSON.parse(text);

            // Flexible empty check for various API structures
            let items: any[] = [];
            if (Array.isArray(data)) items = data;
            else if (Array.isArray(data.data)) items = data.data;
            else if (data.data?.list) items = data.data.list;
            else if (data.data?.bookList) items = data.data.bookList;
            else if (data.bookList) items = data.bookList;
            else if (data.columnVoList) items = data.columnVoList;
            else if (data.contentInfos) items = data.contentInfos;
            else if (data.books) items = data.books;
            else if (data.shortPlayEpisodeInfos) items = data.shortPlayEpisodeInfos;

            const isDetailOrStream = url.includes('detail') || url.includes('stream') || url.includes('allepisode');
            const isSearch = url.includes('search');
            const isEmpty = (Array.isArray(items) && items.length === 0) && !isDetailOrStream;

            if (isSearch || !isEmpty) return data;
            // console.warn('[fetchFromEndpoint] Items empty for: ' + url + '. Retrying...');

        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') {
                // console.warn('[fetchFromEndpoint] rate limited(429) for: ' + url + '. Backing off...');
                globalBackoffuntil = Date.now() + 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                continue;
            }
            // Only log actual errors, not just retries
            if (i === retries - 1) {
                console.error(`[Fetch Error] ${url} : ${error.message || error}`);
            }
        }

        if (i < retries - 1) {
            const waitTime = delay * Math.pow(2, i) + (Math.random() * 200);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return null;
}
