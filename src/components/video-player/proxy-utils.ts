// External proxy is currently rate-limited (429) causing CORS errors.
// Switching to internal VPS proxy for reliability.
export const PROXY_BASE = '/api/proxy';
export const VPS_PROXY = '/api/proxy';

export const shouldUseFallback = (url: string, source: string) => {
    // NetShort from awscdn.netshort.com often has SSL issues with Cloudflare
    // Vigloo needs custom headers from our local VPS proxy
    // DramaDash uses Cloudflare Stream which is blocked by external proxy (429/CORS)
    return (source === 'netshort' && url.includes('awscdn.netshort.com')) || source === 'vigloo' || source === 'dramadash';
};

export const getProxyUrl = (url: string, source: string) => {
    if (!url) return '';

    if ((source === 'netshort' || source === 'vigloo' || source === 'dramadash') && shouldUseFallback(url, source) && !url.includes(VPS_PROXY)) {
        console.log('[VideoPlayer] Using VPS Proxy for', source);
        return VPS_PROXY + '?url=' + encodeURIComponent(url);
    } else if (
        (source === 'dramawave' && url.includes('mydramawave.com') && !url.includes(PROXY_BASE)) ||
        (source === 'dramaflickreels' && !url.includes(PROXY_BASE)) ||
        (source === 'radreel' && url.includes('wolftv.online') && !url.includes(PROXY_BASE)) ||
        (source === 'melolo' && url.includes('tiktokcdn.com') && !url.includes(PROXY_BASE)) ||
        (source === 'dramabox' && !url.includes(PROXY_BASE)) ||
        (source === 'shortmax' && !url.includes(PROXY_BASE)) ||
        (source === 'freeshort' && !url.includes(PROXY_BASE)) ||
        (source === 'stardusttv' && !url.includes(PROXY_BASE)) ||
        (source === 'dotdrama' && !url.includes(PROXY_BASE)) ||
        (source === 'reelife' && !url.includes(PROXY_BASE)) ||
        (source === 'meloshort' && !url.includes(PROXY_BASE)) ||
        (source === 'starshort' && !url.includes(PROXY_BASE))
    ) {
        const proxiedUrl = PROXY_BASE + '?url=' + encodeURIComponent(url);
        if (proxiedUrl.endsWith('?url=')) {
            console.error('[VideoPlayer] Constructed invalid proxy URL');
            return null;
        }
        return proxiedUrl;
    }

    return url;
};
