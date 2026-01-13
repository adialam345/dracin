import { encrypt } from '../../utils/security';

export const VIDEO_PROXIES = [
    'https://rapid-shadow-ff75.cobaakun116.workers.dev/',
    'https://shiny-water-1c5f.cobaakun116.workers.dev/',
    'https://twilight-wildflower-192b.mrxnexsus.workers.dev/',
    'https://winter-paper-bc72.mrxnexsus.workers.dev/',
    'https://late-cake-20fd.acoba937.workers.dev/',
    'https://proud-wind-d018.bagaass5456.workers.dev/',
    'https://plain-recipe-e04b.adialam345.workers.dev/',
    'https://weathered-recipe-4654.thinkaboutzuu.workers.dev/',
    'https://cold-term-8847.cobaa8853.workers.dev/',
    'https://super-brook-9cf2.cobaa614.workers.dev/',
    'https://muddy-wood-2580.isthatkidi.workers.dev/',
    'https://tight-sea-4556.allaboutjijiyaya.workers.dev/',
    'https://young-sky-0806.kidicursor.workers.dev/',
    'https://black-bar-8145.kidicursor7.workers.dev/',
    'https://noisy-bird-9259.kidicursor8.workers.dev/',
    'https://dry-paper-962e.kidicursor85.workers.dev/',
    'https://tiny-wildflower-eb1c.kidicursor11.workers.dev/',
];

export const VPS_PROXY = '/api/proxy';

const isAlreadyProxied = (url: string) => VIDEO_PROXIES.some(p => url.includes(p)) || url.includes(VPS_PROXY);

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
        (source === 'vigloo' && url.includes('cloudfront.net'));

    if (mustUseVps) {
        options.push(`${VPS_PROXY}?q=${encryptedQ}`);
    }

    // Rule 2: Cloudflare Workers (Load Balanced / Alternative)
    const proxyProviders = [
        'dramawave', 'dramaflickreels', 'radreel', 'melolo', 'dramadash',
        'dramabox', 'shortmax', 'freeshort', 'stardusttv', 'dotdrama',
        'reelife', 'meloshort', 'starshort', 'vividshort', 'shorttv', 'dashshort', 'hishort'
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


