import { decrypt } from '../../../utils/security.server';

/**
 * Parse and validate the target URL from request parameters
 */
export function parseTargetUrl(url: URL): { urlStr: string; error: Response | null } {
    const q = url.searchParams.get('q');
    const initialurlStr = url.searchParams.get('url');

    let urlStr = '';

    // Try to decrypt 'q' parameter first
    if (q) {
        const decrypted = decrypt(q);
        if (decrypted) {
            if (typeof decrypted === 'string') {
                urlStr = decrypted;
            } else if (typeof decrypted === 'object') {
                urlStr = decrypted.url || decrypted.videoUrl || decrypted.posterUrl || decrypted.cover || '';
            }
        }
    }

    // Fallback to 'url' parameter
    if (!urlStr && initialurlStr) {
        urlStr = String(initialurlStr);
    }

    // Emergency fallback: If q is raw url
    if (!urlStr && q && q.startsWith('http')) {
        urlStr = q;
    }

    // Recursion check: If the decrypted URL is ITSELF a proxy URL, unwrap it
    if (urlStr && (urlStr.includes('/api/proxy') || urlStr.includes('localhost'))) {
        try {
            const innerUrl = new URL(urlStr, 'http://dummy.com');
            const innerQ = innerUrl.searchParams.get('q');
            if (innerQ) {
                const innerDecrypted = decrypt(innerQ);
                if (innerDecrypted) {
                    if (typeof innerDecrypted === 'string') urlStr = innerDecrypted;
                    else if (typeof innerDecrypted === 'object') urlStr = innerDecrypted.url || innerDecrypted.videoUrl || innerDecrypted.posterUrl || '';
                }
            }
        } catch (e) { }
    }

    urlStr = urlStr.trim();

    // Clean Double Encoding / Quotes anomalies
    if (urlStr.includes('%22') || urlStr.includes('"')) {
        urlStr = urlStr.replace(/%22/g, '').replace(/"/g, '');
    }

    // Check for common URL issues
    if (urlStr.startsWith('//')) {
        urlStr = 'https:' + urlStr;
    }

    // Check for double-encoded URL
    if (urlStr.startsWith('http%3A') || urlStr.startsWith('https%3A')) {
        try {
            urlStr = decodeURIComponent(urlStr);
        } catch (e) {
            console.warn('[Proxy] decodeURIComponent failed, attempting manual fix for:', urlStr.substring(0, 50));
            urlStr = urlStr.replace(/^https%3A%2F%2F/i, 'https://')
                .replace(/^http%3A%2F%2F/i, 'http://');

            // After manual fix, check if rest of URL is garbage
            // If there's still encoded garbage, reject early
            const suspiciousAfterDomain = /[%][0-9A-F]{2}[^a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]/i;
            if (suspiciousAfterDomain.test(urlStr)) {
                console.error(`[Proxy] 400 URL still corrupted after manual decode: ${urlStr.substring(0, 60)}`);
                return { urlStr: '', error: new Response('Corrupted URL', { status: 400 }) };
            }
        }
    }

    // Sanitization: Remove control characters
    urlStr = urlStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

    // Validate URL
    if (!urlStr || urlStr === 'null' || urlStr === 'undefined' || !urlStr.startsWith('http')) {
        console.error(`[Proxy] 400 Invalid URL. Q: ${q?.substring(0, 10)}... | Decrypted type: ${typeof decrypt(q || '')} | Str: ${urlStr}`);
        return { urlStr: '', error: new Response('Missing or invalid url', { status: 400 }) };
    }

    // Validation: Check if URL is actually well-formed
    try {
        const parsedUrl = new URL(urlStr);
        const hostname = parsedUrl.hostname;
        const pathname = parsedUrl.pathname;

        // Garbage detection in pathname
        const suspiciousPathnameChars = /[;$#{}|<>^`\[\]\\]/;
        if (suspiciousPathnameChars.test(pathname)) {
            console.error(`[Proxy] 400 Suspicious pathname rejected: ${urlStr.substring(0, 80)}...`);
            return { urlStr: '', error: new Response('Invalid URL path', { status: 400 }) };
        }

        // Garbage detection in hostname
        if (!/^[a-z0-9.-]+$/i.test(hostname)) {
            console.error(`[Proxy] 400 Invalid hostname rejected: ${hostname}`);
            return { urlStr: '', error: new Response('Invalid hostname', { status: 400 }) };
        }
    } catch (urlError) {
        console.error(`[Proxy] 400 Malformed URL rejected: ${urlStr.substring(0, 80)}...`);
        return { urlStr: '', error: new Response('Malformed URL', { status: 400 }) };
    }

    return { urlStr, error: null };
}
