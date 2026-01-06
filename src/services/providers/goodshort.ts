
import { normalizeGoodShort, type UnifiedDrama } from '../adapter';
import crypto from 'node:crypto';

// Mobile API endpoint
const API_BASE = 'https://api-akm.goodreels.com/hwycclientreels';
// Web API endpoint (fallback for video parsing if needed)
const WEB_API_BASE = 'https://www.goodshort.com/hwycreels';

// Private Key from Android App (sources/c/a.java)
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDLwHQE9g2+/DJm
iVtNS6v0SmHKAEzGaClFMHMNszfi5GDkrA9SjT1Z87tScD2feSSuuKJIoSYL1o3m
qgmX2pCN/5rPzOifJ6gQjGZjLuvuxmvSRk8jHqsPoqj/QH6qhF5n2Mpr5oirGD9I
Ug3RRtdy0RfRuXxHLCnYhKfXKP+TdcK/1Hi/vPONlCpJo7ph62KVeUD+qACYZUNj
diZxklZZASac24OjBdFZOd/ZtINM4wOaHFpwHmnoq89qM1MP09gJc7tPlPONFoWI
AVpfwjtjRsCbFuGQdBf7FlEsxivef2nHFN8J9Q+aqE1wr+ouNbbUkEebYqbt2ROT
Pe7xCJnfAgMBAAECggEBAK3nFR8m45SerGXX1pWigKGA2vYOS3kMbi0frROEY67E
Pe7u7CUJZ9Pes4MpSW9TdnuqGtjishZoibTWbFmvsrF/+CJkQieVMVzueHUvFzA1
KtHOML1I77fonVU/Nt1THUCFSD/QA9YEW/7eCe0VCc51qF7YcbpNd2nVz2tVEs5H
rb1Q0WSdxXaIIyFH4vNS9Xgx4ZY2ULzaJePCbEZcUwFLiJQtIWslGcCDALFyPMN6
W9PKMFo96l0+KruleKfuiTCNzG94Vxe3ClAO64VIa65cSXu6DSUxiD1kedxDPRNE
sZU9qfwNi2gFJCa97KUMBcL2M4VV8guIh4QXQwGoTAECgYEA896OhcFRQXryCAHR
1+pLx3+aqM7qKf9qJWGh+lw/FWBB7cYQ3p+e9BomoQS5OdQcLGy2cTc38zMVvESN
Ek+VS81VnCnVDTKC9vGPvuRItas5RKjNxAQEMJdudGlweEwQqkDlFRktuXwXIRfm
zoA2iV+OUkJW5CDw81+hqMMsRpsCgYEA1eMJiw98fdeya1FJ9PE5x9lZyjyFIQ3y
dsRtSetmeDIETX2AlkHC0HqySbjsIyXsxmq8AajfHraShf6eZeOBsP+sfOPS6J+j
N9reS7gpVbl7EYL3D6OVMBuwZYv9ILkWj6lpfrFBvK8v32eRXgJjJ9LBkAXROBpC
QPMHvPwpTA0CgYA989cPIbpLwTkFUbkGeg4AQ2l94vrX6nwDvRbSLGcWPhrhlcSp
WbGe35napAGOMFVr7741asq67MpjxqJz+WW7GRHbl0D5llBw/ZL/8qyKAlKNH7kO
R9rsoTu9NSAOX3yIU+4eewQDsAOMM6893JJ+OZlFSncag0fS/ANshRCVawKBgQCf
rNUNCcyorgS29YK+5+948RyFTFUe7iia3d2xF5nyFXT83LrIceOcfFzpiLJRMxjmr
/wXSRj49tfATOu3qPbDSrxcqEBmBfd11WGrKZtCMixcUGddN4RC3Aj+ZlncuhDLw
2/Mc0xeLnMQ12LAygt4SXDTsmQU/BWGI2kdfyrdaQKBgDdzsoRSOh+tBtSRqEyc4
BgtfK/FyU7VQy3fUlaaBJEUY6FxE8Icn34VVEeN6YOEmAewEcyMcQQX2ZwQ2wITv
4NssL8uDJ0y4K/TlL+2bomXri/nobvyaDsMfrX6grlQXe4YzVpzGUFbcW+QValHp
acnAjGejZkLM7KD2XaK1Ppf
-----END PRIVATE KEY-----`;

// Helper: Generate UUID/Random Hex
function randomHex(length: number) {
    return crypto.randomBytes(length / 2).toString('hex');
}

// Session Constants
const DEVICE_ID = "3d53f928d1aa4dbc9d50347e95f180ee"; // Using user provided one or randomHex(32)
const PACKAGE_NAME = "com.newreading.goodreels";
// App Sig MD5 from Android implementation is usually checked. 
// Since we are emulating, we try empty first or we might need the real hash.
// Based on analysis, HttpGlobal.java uses empty string if it fails to get signature.
const APP_SIGNATURE_MD5 = "";

// Helper: Generate Signature
function generateSignature(path: string, bodyObj: any, timestamp: string, token: string = '') {
    // 1. Build Payload
    // Format: timestamp=... + bodyJson + deviceId + androidId + token + appSigMD5 + packageName
    let sb = `timestamp=${timestamp}`;

    // Body (if exists, must be raw JSON string without spaces if that's how it's sent, 
    // but usually standard stringify is fine as long as consistent)
    // The previous analysis suggests 'Gson' default serialization which is standard JSON.
    // NOTE: The Python script used separators=(',', ':') to remove spaces. Java Gson default might be compact?
    // Let's assume compact JSON.
    if (bodyObj && Object.keys(bodyObj).length > 0) {
        sb += JSON.stringify(bodyObj);
    }

    sb += DEVICE_ID;
    sb += ""; // androidId (empty in headers usually if not provided explicitly)

    if (token) {
        sb += token;
    }

    sb += APP_SIGNATURE_MD5.toUpperCase();
    sb += PACKAGE_NAME;

    console.log(`[GoodShort] Signing Path: ${path}, String: ${sb.substring(0, 50)}...`);

    // 2. Sign with RSA-SHA256
    const sign = crypto.createSign('SHA256');
    sign.update(sb);
    sign.end();
    return sign.sign(PRIVATE_KEY_PEM, 'base64');
}

// Headers Generator
// Headers Generator
function getHeaders(path: string, body: any, token: string, timestamp: string) {
    const signature = generateSignature(path, body, timestamp, token);

    return {
        "Host": "api-akm.goodreels.com",
        "channelCode": "GSASA00001",
        "deviceId": DEVICE_ID,
        "platform": "ANDROID",
        "Accept": "*/*",
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "GoodReels/1.0.51 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Mobile Safari/537.36",
        "pname": PACKAGE_NAME,
        "Authorization": token,
        "sign": signature,
        // "timestamp": timestamp, // Timestamp is typically only in URL based on Android code
        "Accept-Language": "en-US",
        "Connection": "keep-alive"
    };
}

// Hardcoded token from recent conversation (should be refreshed if possible, but good start)
const AUTH_TOKEN = "Bearer ZXlKMGVYQWlPaUpLVjFRaUxDSmhiR2NpT2lKSVV6STFOaUo5LmV5SnlaV2RwYzNSbGNsUjVjR1VpT2lKVVJVMVFJaXdpZFhObGNrbGtJam94T0RRME9URXpOVFI5LmZtenBYa21ndW9sOTZuaGpsY2FZUFRqcWQ2Rk5kUHRpRjJNdWwxQW9tRFE=";

async function fetchMobileApi(path: string, body: any) {
    const timestamp = Date.now().toString();
    const url = `${API_BASE}${path}?timestamp=${timestamp}`;
    const headers = getHeaders(path, body, AUTH_TOKEN, timestamp);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.error(`[GoodShort] API Error ${response.status} for ${path}`);
            return null;
        }

        return await response.json();
    } catch (e) {
        console.error(`[GoodShort] Network Error for ${path}:`, e);
        return null;
    }
}

// --- Adapters ---

export async function getGoodShortHome(): Promise<UnifiedDrama[]> {
    // API: /home/index
    // Body needs channelType not rankType (from p0/d0 analysis)

    const body = {
        "channelId": "GSASA00001",
        "channelType": 1,
        "vipBookEnable": false,
        "pageNo": 1,
        "pageSize": 20
    };

    const data = await fetchMobileApi('/home/index', body);

    if (data && data.data && data.data.list) {
        return data.data.list.map((item: any) => normalizeGoodShort({
            ...item,
            bookId: item.bookId || item.id,
            cover: item.cover || item.cover2,
        }));
    }

    console.warn('[GoodShort] Home API returned no list, attempting Web API fallback');

    // Web API Fallback (using the logic that was there before)
    const seedDramaIds = ['31001223187', '31000914420'];
    const allDramas: UnifiedDrama[] = [];
    const seenIds = new Set<string>();

    for (const seedId of seedDramaIds) {
        try {
            const url = `${WEB_API_BASE}/book/detail`;
            const webBoxy = { "bookId": seedId };
            const webRes = await fetch(url, {
                method: 'POST',
                headers: {
                    "content-type": "application/json;charset=UTF-8",
                    "platform": "WEB",
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                },
                body: JSON.stringify(webBoxy)
            });
            const webData = await webRes.json();

            if (webData && webData.data) {
                const combined = [...(webData.data.recommends || []), ...(webData.data.guessLike || [])];
                combined.forEach((item: any) => {
                    const id = item.bookId || item.id;
                    if (id && !seenIds.has(id)) {
                        seenIds.add(id);
                        allDramas.push(normalizeGoodShort(item));
                    }
                });
            }
        } catch (e) {
            console.error('[GoodShort] Web fallback error:', e);
        }
    }
    return allDramas;
}

export async function searchGoodShort(query: string): Promise<UnifiedDrama[]> {
    // Java Code: RequestService.java -> B -> /book/search1
    const body = {
        "keyword": query,
        "pageNo": 1,
        "pageSize": 20,
        "searchType": 1
    };

    const data = await fetchMobileApi('/book/search1', body);
    if (data && data.data && data.data.list) {
        return data.data.list.map((item: any) => normalizeGoodShort({
            ...item,
            bookId: item.bookId || item.id,
            cover: item.cover || item.cover2
        }));
    }
    return [];
}

export async function getGoodShortDetail(id: string): Promise<{ drama: UnifiedDrama, episodes: any[], videoUrl?: string } | null> {
    // 1. Try Mobile API
    const epBody = {
        "bookId": id,
        "chapterCount": 500,
        "latestChapterId": 0,
        "needBookInfo": true
    };

    const data = await fetchMobileApi('/chapter/list', epBody);

    if (data && data.data) {
        const info = data.data.bookInfo || {};
        const chapters = data.data.chapterList || [];

        const drama = normalizeGoodShort({
            bookId: info.bookId || id,
            name: info.bookName || info.name || "Unknown Title",
            cover: info.cover || info.cover2,
            introduction: info.introduction,
            chapterCnt: info.chapterCount,
            ratings: info.score
        });

        const episodes = chapters.map((ch: any, idx: number) => ({
            id: ch.id?.toString(),
            name: ch.chapterName || `Episode ${idx + 1}`,
            index: idx,
            unlock: ch.price === 0,
            raw: ch
        }));

        return { drama, episodes };
    }

    // 2. Web API Fallback
    console.warn('[GoodShort] Mobile detail fetch failed, trying Web fallback...');
    try {
        const url = `${WEB_API_BASE}/book/detail`;
        const webRes = await fetch(url, {
            method: 'POST',
            headers: {
                "content-type": "application/json;charset=UTF-8",
                "platform": "WEB",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            body: JSON.stringify({ "bookId": id })
        });
        const webData = await webRes.json();

        if (webData && webData.data && webData.data.book) {
            const result = webData.data;
            const bookInfo = result.book;

            const drama = normalizeGoodShort({
                bookId: bookInfo.bookId || id,
                name: bookInfo.bookName || bookInfo.name,
                introduction: bookInfo.introduction || 'No description available',
                cover: bookInfo.cover || bookInfo.cover2,
                chapterCnt: bookInfo.chapterCount || result.chapterVoList?.length || 0,
                viewCount: bookInfo.viewCount,
                ratings: bookInfo.ratings,
                writeStatus: bookInfo.writeStatus,
                typeTwoNames: bookInfo.typeTwoNames
            });

            const episodeList = result.chapterVoList || [];
            let episodes: any[] = [];
            if (Array.isArray(episodeList)) {
                episodes = episodeList.map((ep: any, index: number) => {
                    return {
                        id: ep.id ? ep.id.toString() : String(index + 1),
                        name: ep.chapterName || `Episode ${index + 1}`,
                        index: index,
                        unlock: ep.price === 0 || ep.price === undefined,
                        raw: ep
                    };
                });
            }

            return { drama, episodes };
        }
    } catch (e) {
        console.error('[GoodShort] Web detail fallback error:', e);
    }

    return null;
}

export async function getGoodShortVideoUrl(bookId: string, episodeId: string): Promise<string> {
    // 1. Try Mobile API (likely failing now)
    const body = {
        "bookId": bookId,
        "chapterId": parseInt(episodeId),
        "autoPay": false,
        "checkAutoPay": false
    };

    const data = await fetchMobileApi('/chapter/load', body);

    if (data && data.data) {
        const ch = data.data.currentChapter;
        if (ch && ch.chapterContent && ch.chapterContent.m3u8Path) {
            return ch.chapterContent.m3u8Path;
        }
        if (ch && ch.m3u8Path) return ch.m3u8Path;
    }

    // 2. Fallback to Web API
    console.warn('[GoodShort] Mobile video load failed, trying Web fallback...');
    try {
        const url = `${WEB_API_BASE}/book/detail`;
        const webRes = await fetch(url, {
            method: 'POST',
            headers: {
                "content-type": "application/json;charset=UTF-8",
                "platform": "WEB",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            body: JSON.stringify({ "bookId": bookId })
        });
        const webData = await webRes.json();

        if (webData && webData.data && webData.data.chapterVoList) {
            const ep = webData.data.chapterVoList.find((e: any) => String(e.id) === String(episodeId));
            if (ep && ep.m3u8Path) {
                return ep.m3u8Path;
            }
        }
    } catch (e) {
        console.error('[GoodShort] Web video fallback error:', e);
    }

    console.error('[GoodShort] Failed to load video url for', bookId, episodeId);
    return '';
}
