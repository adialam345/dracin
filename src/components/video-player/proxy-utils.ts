import { encrypt } from '../../utils/security';

export const VIDEO_PROXIES = [
    'https://videoproxy.cobaakun116.workers.dev/',
    'https://video-proxy.mrxnexsus.workers.dev/',
    'https://video.adialam347.workers.dev',
    'https://video.thinkaboutzuu.workers.dev',
    'https://old-leaf-1ebb.olirmais.workers.dev',
];

export const VPS_PROXY = '/api/proxy';

const isAlreadyProxied = (url: string) =>
    VIDEO_PROXIES.some(p => url.includes(p)) ||
    url.includes(VPS_PROXY) ||
    url.includes('dramabos.asia/api/shortime/proxy');

export const shouldUseFallback = (url: string, source: string) => {
    // NetShort from awscdn.netshort.com often has SSL issues with Cloudflare
    return (source === 'netshort' && url.includes('awscdn.netshort.com'));
};

/**
 * Mendapatkan daftar URL proxy yang bisa dicoba secara berurutan
 */
export const getAllProxyOptions = (url: string, source: string): string[] => {
    if (!url || isAlreadyProxied(url)) return [url];

    const options: string[] = [];
    const encryptedQ = encodeURIComponent(encrypt({ url }));

    // Rule 1: Priority VPS Proxy for sensitive providers
    const mustUseVps = (source === 'netshort' && shouldUseFallback(url, source)) ||
        (source === 'vigloo' && url.includes('cloudfront.net')) ||
        (source === 'dramaflickreels') ||
        (source === 'shorttime');

    if (mustUseVps) {
        options.push(`${VPS_PROXY}?q=${encryptedQ}`);
    }

    // Rule 2: Cloudflare Workers (Load Balanced / Alternative)
    const proxyProviders = [
        'dramawave', 'dramaflickreels', 'radreel', 'melolo', 'dramadash',
        'dramabox', 'shortmax', 'freeshort', 'stardusttv', 'dotdrama',
        'reelife', 'meloshort', 'starshort', 'vividshort', 'shorttv', 'dashshort', 'netshort'
    ];

    if (proxyProviders.includes(source) || url.includes('dramaboxdb.com') || url.includes('wolftv.online')) {
        // Tambahkan semua worker ke opsi (acak urutannya agar beban terbagi)
        const shuffledWorkers = [...VIDEO_PROXIES].sort(() => Math.random() - 0.5);
        shuffledWorkers.forEach(worker => {
            options.push(`${worker}?url=${encodeURIComponent(url)}`);
        });
    }

    // Rule 3: Always add VPS Proxy as final fallback if not already added
    const vpsUrl = `${VPS_PROXY}?q=${encryptedQ}`;
    if (!options.includes(vpsUrl)) {
        options.push(vpsUrl);
    }

    // Rule 4: Final fallback is the direct URL
    options.push(url);

    return options;
};

// Compatibility export
export const getProxyUrl = (url: string, source: string) => {
    const options = getAllProxyOptions(url, source);
    return options[0];
};


