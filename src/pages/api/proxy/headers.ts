export function getProxyHeaders(targetUrl: string, incomingHeaders: Headers): Record<string, string> {
    const headers: Record<string, string> = {
        'User-Agent': incomingHeaders.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const range = incomingHeaders.get('Range');
    if (range && !targetUrl.includes('.m3u8')) {
        headers['Range'] = range;
    }

    // Forward Conditional Request Headers (Saves Bandwidth)
    const ifNoneMatch = incomingHeaders.get('if-none-match');
    if (ifNoneMatch) headers['If-None-Match'] = ifNoneMatch;

    const ifModifiedSince = incomingHeaders.get('if-modified-since');
    if (ifModifiedSince) headers['If-Modified-Since'] = ifModifiedSince;

    // Domain Specific logic
    if (targetUrl.includes('mydramawave.com')) {
        headers['Referer'] = 'https://www.mydramawave.com';
        headers['Origin'] = 'https://www.mydramawave.com';
    }
    else if (targetUrl.includes('farsunpteltd.com')) {
        Object.assign(headers, {
            'Token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJfIiwiYXVkIjoiXyIsImlhdCI6MTc2NzI5NTM2OSwiZGF0YSI6eyJtZW1iZXJfaWQiOjQ1MTMwNTUwLCJwYWNrYWdlX2lkIjoiMSIsIm1haW5fcGFja2FnZV9pZCI6IjEwMCJ9fQ.U2HoYm4QEZfZ_QU9eGkzOzzQZRPGfeLKIc3qzefchQQ',
            'bundleIdentifier': 'com.farsun.shortplay',
            'Version': '2.2.2.0',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
        });
    }
    else if (targetUrl.includes('vividshort.com')) {
        headers['Origin'] = 'https://www.vividshort.com';
        headers['Referer'] = 'https://www.vividshort.com/';
    }
    else if (targetUrl.includes('netshort.com')) {
        headers['Referer'] = 'https://www.netshort.com/';
        headers['Accept'] = '*/*';
        headers['Accept-Encoding'] = 'identity';
    }
    else if (targetUrl.includes('wolftv.online')) {
        headers['Referer'] = 'https://www.wolftv.online/';
        headers['Origin'] = 'https://www.wolftv.online';
    }
    else if (targetUrl.includes('tiktokcdn.com')) {
        headers['Referer'] = 'https://www.tiktok.com/';
        headers['Origin'] = 'https://www.tiktok.com';
    }
    else if (targetUrl.includes('cloudflarestream.com')) {
        headers['User-Agent'] = 'DramaDash/50 CFNetwork/1474 Darwin/23.0.0';
        headers['Origin'] = 'https://dramadash.app';
        headers['Referer'] = 'https://dramadash.app/';
    }
    else if (targetUrl.includes('shorttv.live')) {
        headers['Origin'] = 'https://www.shorttv.live';
        headers['Referer'] = 'https://www.shorttv.live/';
    }
    else if (targetUrl.includes('stardusttv.cc') || targetUrl.includes('stardust-tv.com')) {
        headers['Origin'] = 'https://www.stardusttv.net';
        headers['Referer'] = 'https://www.stardusttv.net/';
    }
    else if (targetUrl.includes('vigloo.com')) {
        headers['Origin'] = 'https://www.vigloo.com';
        headers['Referer'] = 'https://www.vigloo.com/';
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
    else {
        try {
            headers['Referer'] = new URL(targetUrl).origin + '/';
        } catch (e) {
            // Ignore for invalid URLs
        }
    }

    return headers;
}
