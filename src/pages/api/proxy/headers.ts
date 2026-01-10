/**
 * Build headers based on the target URL and provider
 */
export function buildHeaders(urlStr: string, request: Request): Record<string, string> {
    const headers: Record<string, string> = {
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Encoding': request.headers.get('Accept-Encoding') || 'identity',
        ...((request.headers.get('Range') && !urlStr.includes('.m3u8')) ? { 'Range': request.headers.get('Range')! } : {})
    };

    // Forward Conditional Request Headers
    if (request.headers.get('if-none-match')) headers['If-None-Match'] = request.headers.get('if-none-match')!;
    if (request.headers.get('if-modified-since')) headers['If-Modified-Since'] = request.headers.get('if-modified-since')!;

    // Provider-specific headers
    if (urlStr.includes('mydramawave.com')) {
        headers['Origin'] = 'https://www.mydramawave.com';
        headers['Referer'] = 'https://www.mydramawave.com/';
    }
    else if (urlStr.includes('farsunpteltd.com')) {
        Object.assign(headers, {
            'Token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJfIiwiYXVkIjoiXyIsImlhdCI6MTc2NzI5NTM2OSwiZGF0YSI6eyJtZW1iZXJfaWQiOjQ1MTMwNTUwLCJwYWNrYWdlX2lkIjoiMSIsIm1haW5fcGFja2FnZV9pZCI6IjEwMCJ9fQ.U2HoYm4QEZfZ_QU9eGkzOzzQZRPGfeLKIc3qzefchQQ',
            'bundleIdentifier': 'com.farsun.shortplay',
            'Version': '2.2.2.0',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
        });
    }
    else if (urlStr.includes('vividshort.com')) {
        headers['Origin'] = 'https://www.vividshort.com';
        headers['Referer'] = 'https://www.vividshort.com/';
    }
    else if (urlStr.includes('netshort.com')) {
        headers['Referer'] = 'https://www.netshort.com/';
        headers['Accept'] = '*/*';
        headers['Accept-Encoding'] = 'identity';
    }
    else if (urlStr.includes('wolftv.online')) {
        headers['Referer'] = 'https://www.wolftv.online/';
        headers['Origin'] = 'https://www.wolftv.online';
    }
    else if (urlStr.includes('tiktokcdn.com')) {
        headers['Referer'] = 'https://www.tiktok.com/';
        headers['Origin'] = 'https://www.tiktok.com';
    }
    else if (urlStr.includes('cloudflarestream.com')) {
        headers['User-Agent'] = 'DramaDash/50 CFNetwork/1474 Darwin/23.0.0';
        headers['Origin'] = 'https://dramadash.app';
        headers['Referer'] = 'https://dramadash.app/';
    }
    else if (urlStr.includes('shorttv.live')) {
        headers['Origin'] = 'https://www.shorttv.live';
        headers['Referer'] = 'https://www.shorttv.live/';
    }
    else if (urlStr.includes('stardusttv.cc') || urlStr.includes('stardust-tv.com')) {
        headers['Origin'] = 'https://www.stardusttv.net';
        headers['Referer'] = 'https://www.stardusttv.net/';
    }
    else if (urlStr.includes('dramabox')) {
        headers['Referer'] = 'https://www.dramaboxdb.com/';
        headers['Origin'] = 'https://www.dramaboxdb.com';
    }
    else if (urlStr.includes('vigloo.com')) {
        headers['Origin'] = 'https://www.vigloo.com';
        headers['Referer'] = 'https://www.vigloo.com/';
    }
    else {
        // Default Referer to origin of target
        try {
            const u = new URL(urlStr);
            headers['Referer'] = u.origin + '/';
        } catch (e) {
            headers['Referer'] = urlStr;
        }
    }

    return headers;
}

/**
 * Check if the URL should use worker proxies
 */
export function shouldUseWorker(urlStr: string): boolean {
    return (urlStr.includes('dramabox') ||
        urlStr.includes('shortmax') ||
        urlStr.includes('wolftv.online') ||
        urlStr.includes('mydramawave.com') ||
        urlStr.includes('farsunpteltd.com')) && !urlStr.includes('vigloo.com');
}

/**
 * Check if this is a NetShort URL (requires special handling)
 */
export function isNetShortUrl(urlStr: string): boolean {
    return urlStr.includes('netshort.com');
}
