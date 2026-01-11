import dns from 'node:dns';
import https from 'node:https';
import zlib from 'node:zlib';

// Force IPv4 to avoid ECONNRESET on some hosting providers where IPv6 is flaky
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

export const API_BASE = 'https://api.sansekai.my.id/api';

export const PROXY_LIST = [
    'https://rapid-shadow-ff75.cobaakun116.workers.dev',
    'https://shiny-water-1c5f.cobaakun116.workers.dev',
    'https://twilight-wildflower-192b.mrxnexsus.workers.dev',
    'https://winter-paper-bc72.mrxnexsus.workers.dev',
    'https://late-cake-20fd.acoba937.workers.dev',
    'https://proud-wind-d018.bagaass5456.workers.dev',
    'https://plain-recipe-e04b.adialam345.workers.dev',
    'https://weathered-recipe-4654.thinkaboutzuu.workers.dev',
    'https://cold-term-8847.cobaa8853.workers.dev',
    'https://super-brook-9cf2.cobaa614.workers.dev',
    'https://muddy-wood-2580.isthatkidi.workers.dev',
    'https://tight-sea-4556.allaboutjijiyaya.workers.dev'

];

const getRandomProxy = () => PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];

// Simple in-memory cache for server-side requests dengan limit RAM
class LimitedMap<K, V> extends Map<K, V> {
    constructor(private maxSize: number) {
        super();
    }
    set(key: K, value: V): this {
        if (!this.has(key) && this.size >= this.maxSize) {
            const firstKey = this.keys().next().value;
            if (firstKey !== undefined) this.delete(firstKey);
        }
        return super.set(key, value);
    }
}

const serverCache = new LimitedMap<string, { data: any, expiry: number }>(1000); // Max 1000 item
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
const DEAD_PROXIES = new Set<string>();
let lastDeadReset = Date.now();

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
function httpsRequest(url: string, customHeaders: any = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        const options: https.RequestOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            agent: httpsAgent,
            headers: {
                'User-Agent': customHeaders['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                ...customHeaders,
                ...(url.includes('api.sansekai.my.id') ? {
                    'Referer': 'https://sansekai.my.id/',
                    'Origin': 'https://sansekai.my.id'
                } : {})
            },
            timeout: 20000
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
                    const error = new Error(`HTTP ${res.statusCode}`);
                    (error as any).statusCode = res.statusCode;
                    (error as any).body = data;
                    reject(error);
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

export async function fetchCached(url: string, retries: number = 3, headers: any = {}): Promise<any> {
    const cached = serverCache.get(url);
    if (cached && cached.expiry > Date.now()) {
        return cached.data;
    }

    const data = await fetchFromEndpoint(url, retries, 300, headers);
    // Only cache successful, non-empty results
    if (data && (!Array.isArray(data) || data.length > 0)) {
        serverCache.set(url, { data, expiry: Date.now() + CACHE_TTL });
    }
    return data;
}

export async function fetchFromEndpoint(url: string, retries: number = 3, delay: number = 300, headers: any = {}): Promise<any> {
    // Reset dead proxies every hour
    if (Date.now() - lastDeadReset > 3600000) {
        DEAD_PROXIES.clear();
        lastDeadReset = Date.now();
    }

    // Filter out dead proxies
    let availableProxies = PROXY_LIST.filter(p => !DEAD_PROXIES.has(p));

    // If all dead, clear dead list to retry all (failover)
    if (availableProxies.length === 0) {
        console.warn('[Proxy] All proxies marked dead. Resetting list.');
        DEAD_PROXIES.clear();
        availableProxies = [...PROXY_LIST];
    }

    const maxAttempts = Math.max(retries, availableProxies.length);

    for (let i = 0; i < maxAttempts; i++) {
        const now = Date.now();
        if (now < globalBackoffuntil) {
            await new Promise(resolve => setTimeout(resolve, globalBackoffuntil - now));
        }

        const currentProxy = availableProxies[i % availableProxies.length];

        try {
            const targetUrl = currentProxy
                ? `${currentProxy}?url=${encodeURIComponent(url)}`
                : url;

            const text = await httpsRequest(targetUrl, headers);

            // Check for Cloudflare specific text error even in 200 OK
            if (text.includes('Worker threw exception') || text.includes('Error 1101') || text.includes('Error 1027')) {
                throw new Error('WORKER_ERROR_IN_BODY');
            }

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

            const isDetailOrStream = url.includes('detail') || url.includes('stream') || url.includes('allepisode') ||
                url.includes('drama') || url.includes('program') || url.includes('compilations') ||
                url.includes('play') || url.includes('info');
            const isSearch = url.includes('search');
            // If it's a detail/stream page, we don't consider empty list as a failure that needs retry
            const isEmpty = (Array.isArray(items) && items.length === 0) && !isDetailOrStream;

            if (isSearch || !isEmpty || isDetailOrStream) return data;

        } catch (error: any) {
            const statusCode = error.statusCode;
            const body = error.body || (error.message === 'WORKER_ERROR_IN_BODY' ? 'Worker Error' : '');

            const isBlocked = error.message.includes('403') || statusCode === 403;
            const isWorkerLimited =
                statusCode === 529 ||
                statusCode === 503 ||
                body.includes('1015') ||
                body.includes('1027') ||
                body.includes('Worker exceeded description') ||
                error.message === 'WORKER_ERROR_IN_BODY';

            if (error.message === 'RATE_LIMITED' || statusCode === 429) {
                globalBackoffuntil = Date.now() + 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                continue;
            }

            if (isWorkerLimited) {
                console.warn(`[Proxy Dead] ${currentProxy} limit reached. Marking as dead.`);
                DEAD_PROXIES.add(currentProxy);
                if (availableProxies.length > 1) continue;
            }

            if (isBlocked) {
                console.warn(`[Proxy Blocked] ${currentProxy} returned 403 for ${url}. Trying next...`);
                continue;
            }

            if (i === maxAttempts - 1) {
                console.error(`[Fetch Error] ${url} : ${error.message || error}`);
            }
        }

        if (i < maxAttempts - 1) {
            const waitTime = delay * Math.pow(2, i) + (Math.random() * 200);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return null;
}
