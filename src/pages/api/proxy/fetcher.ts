import { PROXY_LIST } from '../../../services/utils';
import { shouldUseWorker } from './headers';

export interface FetchResult {
    response: Response | undefined;
    error?: string;
}

/**
 * Fetch with proxy fallback strategy
 */
export async function fetchWithFallback(
    urlStr: string,
    headers: Record<string, string>,
    isImageRequest: boolean
): Promise<FetchResult> {
    const fetchWithProxy = async (url: string, proxyUrl?: string) => {
        const finalUrl = proxyUrl ? `${proxyUrl}?url=${encodeURIComponent(url)}` : url;
        return fetch(finalUrl, {
            headers,
            signal: AbortSignal.timeout(proxyUrl ? 15000 : (isImageRequest ? 5000 : 15000))
        });
    };

    const useWorker = shouldUseWorker(urlStr);
    let response: Response | undefined;

    try {
        if (useWorker) {
            // Strategy: Worker 1 -> Worker 2 -> Direct
            response = await fetchWithProxy(urlStr, PROXY_LIST[0])
                .catch(() => undefined);

            if (!response || !response.ok) {
                const w2res = await fetchWithProxy(urlStr, PROXY_LIST[1]).catch(() => undefined);
                if (w2res && w2res.ok) response = w2res;
            }

            // Fallback to Direct if workers failed
            if (!response || (!response.ok && response.status === 429)) {
                console.log(`[Proxy] Workers failed/limited for ${urlStr.substring(0, 30)}..., trying direct.`);
                const directRes = await fetchWithProxy(urlStr).catch(() => undefined);
                if (directRes) response = directRes;
            }
        } else {
            // Try Direct, then Worker 1
            response = await fetchWithProxy(urlStr).catch(async () => {
                return fetchWithProxy(urlStr, PROXY_LIST[0]).catch(() => undefined);
            });
        }
    } catch (e: any) {
        console.error(`[Proxy] Critical fetch error for ${urlStr.substring(0, 50)}: ${e.message}`);
        // Last ditch effort
        try {
            response = await fetchWithProxy(urlStr, PROXY_LIST[0]).catch(() => undefined);
        } catch (e2) { }
    }

    return { response };
}

/**
 * Check if the request is for an image
 */
export function isImageRequest(urlStr: string): boolean {
    return !!(urlStr.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i) || urlStr.includes('ksh-img') || urlStr.includes('img'));
}
