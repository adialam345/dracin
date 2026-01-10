import { encrypt } from '../../utils/security';

export const VIDEO_PROXIES = [
    'https://videoproxy.cobaakun116.workers.dev/',
];

export const PROXY_BASE = VIDEO_PROXIES[0];
export const VPS_PROXY = '/api/proxy';

const isAlreadyProxied = (url: string) => VIDEO_PROXIES.some(p => url.includes(p));
const getRandomProxy = () => VIDEO_PROXIES[Math.floor(Math.random() * VIDEO_PROXIES.length)];

export const shouldUseFallback = (url: string, source: string) => {
    // NetShort from awscdn.netshort.com often has SSL issues with Cloudflare
    return (source === 'netshort' && url.includes('awscdn.netshort.com'));
};

export const getProxyUrl = (url: string, source: string) => {
    if (!url) return '';

    // Encrypt the URL for our internal proxy
    const encryptedQ = encodeURIComponent(encrypt({ url }));

    if (
        source === 'netshort' &&
        shouldUseFallback(url, source) &&
        !url.includes(VPS_PROXY)
    ) {
        console.log('[VideoPlayer] Using Encrypted VPS Proxy for', source);
        return `${VPS_PROXY}?q=${encryptedQ}`;
    } else if (
        (source === 'dramawave' && url.includes('mydramawave.com') && !isAlreadyProxied(url)) ||
        (source === 'dramaflickreels' && !isAlreadyProxied(url)) ||
        (source === 'radreel' && url.includes('wolftv.online') && !isAlreadyProxied(url)) ||
        (source === 'melolo' && url.includes('tiktokcdn.com') && !isAlreadyProxied(url)) ||
        (source === 'dramadash' && !isAlreadyProxied(url)) ||
        (source === 'dramabox' && !isAlreadyProxied(url)) ||
        (source === 'shortmax' && !isAlreadyProxied(url)) ||
        (source === 'freeshort' && !isAlreadyProxied(url)) ||
        (source === 'stardusttv' && !isAlreadyProxied(url)) ||
        (source === 'dotdrama' && !isAlreadyProxied(url)) ||
        (source === 'reelife' && !isAlreadyProxied(url)) ||
        (source === 'meloshort' && !isAlreadyProxied(url)) ||
        (source === 'starshort' && !isAlreadyProxied(url))
    ) {
        // For external proxy, we still use 'url' because it doesn't know our 'q' encryption
        const selectedProxy = getRandomProxy();
        return `${selectedProxy}?url=${encodeURIComponent(url)}`;
    }

    return url;
};
