
import { normalizeGoodShort, type UnifiedDrama } from '../adapter';

// Mobile API for home feed
const API_BASE = 'https://api-akm.goodreels.com/hwycclientreels';

// Using the web API endpoint that provides m3u8 URLs directly
const WEB_API_BASE = 'https://www.goodshort.com/hwycreels';

// HARDCODED HEADERS FROM USER (May expire!)
const HOME_HEADERS = {
    "Host": "api-akm.goodreels.com",
    "channelCode": "GSASA00001",
    "deviceId": "3d53f928d1aa4dbc9d50347e95f180ee",
    "bigdataSession": "FB7F81F0-9FAC-4673-A273-D36937AD368E",
    "platform": "IOS",
    "Accept": "*/*",
    "apn": "2",
    "Content-Type": "application/json",
    "User-Agent": "GoodShort/2.4.1 (iPhone; iOS 17.0.3; Scale/3.00)",
    "pname": "com.newreading.goodreels",
    "localTime": "2026-01-05 20:45:58.016 +0700",
    "Cookie": 'RT="z=1&dm=api-akm.goodreels.com&si=cc888172-3aac-457a-8298-920eb1607219&ss=mk14veb5&sl=1&tt=11u&rl=1&ld=3e7"',
    "brand": "apple",
    "Accept-Language": "id-ID;q=1",
    "lqa": "0",
    "p": "186",
    "currentLanguage": "in",
    "model": "iPhone 12",
    "ramSize": "3840163840",
    "afid": "1767615583636-3539281",
    "os": "17.0.3",
    "Authorization": "Bearer ZXlKMGVYQWlPaUpLVjFRaUxDSmhiR2NpT2lKSVV6STFOaUo5LmV5SnlaV2RwYzNSbGNsUjVjR1VpT2lKVVJVMVFJaXdpZFhObGNrbGtJam94T0RRME9URXpOVFI5LkpuV0cwWmNfMmczZGVwWDF4YWZvc19VdXk1QnlneG10TXBGNVhCbHVjSmM=",
    "sign": "tOATxkCi6oxWiTVKRrC4d60dSRAbZK/sl/EY8wmd4t6sJDqG+VvkunmKqiajMUvq3gC/wyHbosWT3HWyCiKVUMWJFUZH9HYWRcT6kmepBJPHZt2y7myeZCedGl6B66PgoWAmwet/U2SrtHofMqzOZ5Ux5nXuzfAW8eF6fCTlHmYkPaxWGZsjEGKESkU2pUWxMu8X/ab6TBj7EbgutFmHbwvno/qx5DMJu9p1HPqtrZJwUzDcZ6NwDu2sULzvT98+3slwd7mNe4S/VrmhMSl1Zdrx0j1OZiNuq5TS6MK9/MJImJDYAnRLhg8q4tJ8JifzgParjR/yfx8Bg6VRDlCNPw==",
    "gender": "UNKNOWN",
    "sysModel": "iPhone13,2",
    "appVersion": "204010",
    "romSize": "63870980096",
    "language": "in",
    "timeZone": "+0700",
    "userId": "184491354"
};

// Web API headers (from browser network tab)
const WEB_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "id-ID,id;q=0.9,und;q=0.8,en;q=0.7",
    "content-type": "application/json;charset=UTF-8",
    "currentlanguage": "id",
    "platform": "WEB",
    "origin": "https://www.goodshort.com",
    "referer": "https://www.goodshort.com/id",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
};

async function fetchGoodShort(url: string, body: any, headers: any = WEB_HEADERS) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            console.error('[GoodShort] API error:', response.status);
            return null;
        }
        return await response.json();
    } catch (e) {
        console.error('[GoodShort] Network error:', e);
        return null;
    }
}

// Use web API with a workaround: fetch a popular drama and get recommendations
export async function getGoodShortHome(): Promise<UnifiedDrama[]> {
    // Popular drama IDs to fetch recommendations from
    const seedDramaIds = [
        '31001223187', // Dapat 5 Anak, Ibunya Ratu
        '31000914420', // Berawal dari Kesalahpahaman
        '31001210540', // Titik Putus Sebuah Cinta
        '31000767023', // Kembar Lima Bersatu
    ];

    const allDramas: UnifiedDrama[] = [];
    const seenIds = new Set<string>();

    // Fetch recommendations from multiple seed dramas
    for (const seedId of seedDramaIds) {
        try {
            const url = `${WEB_API_BASE}/book/detail`;
            const body = { "bookId": seedId };
            const data = await fetchGoodShort(url, body, WEB_HEADERS);

            if (data && data.data) {
                // Get recommendations from this drama
                const recommends = data.data.recommends || [];
                const guessLike = data.data.guessLike || [];

                // Combine both lists
                const combined = [...recommends, ...guessLike];

                combined.forEach((item: any) => {
                    const id = item.bookId || item.id;
                    if (id && !seenIds.has(id)) {
                        seenIds.add(id);
                        allDramas.push(normalizeGoodShort(item));
                    }
                });
            }
        } catch (e) {
            console.error('[GoodShort] Error fetching recommendations from', seedId, e);
        }
    }

    console.log('[GoodShort] Home feed collected', allDramas.length, 'dramas from recommendations');
    return allDramas;
}

// Search is disabled for now since we don't have a working endpoint
export async function searchGoodShort(query: string): Promise<UnifiedDrama[]> {
    console.warn('[GoodShort] Search not implemented for web API');
    return [];
}

export async function getGoodShortDetail(id: string): Promise<{ drama: UnifiedDrama, episodes: any[], videoUrl?: string } | null> {
    const url = `${WEB_API_BASE}/book/detail`;
    const body = {
        "bookId": id
    };

    const data = await fetchGoodShort(url, body, WEB_HEADERS);

    // Response structure: { data: { book: {...}, chapterVo: {...}, chapterVoList: [...] } }
    if (!data || !data.data) return null;

    const result = data.data;
    const bookInfo = result.book;

    if (!bookInfo) return null;

    // Normalize the drama info
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

    // Episodes are in chapterVoList
    const episodeList = result.chapterVoList || [];

    let episodes: any[] = [];
    if (Array.isArray(episodeList)) {
        episodes = episodeList.map((ep: any, index: number) => {
            return {
                id: ep.id ? ep.id.toString() : String(index + 1),
                name: ep.chapterName || `Episode ${index + 1}`,
                index: index,
                unlock: ep.price === 0 || ep.price === undefined,
                raw: ep  // Store the full episode data including m3u8Path
            };
        });
    }

    console.log("[GoodShort] Detail fetched for", id, "- Episodes:", episodes.length);
    return { drama, episodes };
}

export async function getGoodShortVideoUrl(bookId: string, episodeId: string): Promise<string> {
    // Get the detail which includes all episodes with their m3u8 URLs
    const url = `${WEB_API_BASE}/book/detail`;
    const body = {
        "bookId": bookId
    };

    const data = await fetchGoodShort(url, body, WEB_HEADERS);

    if (data && data.data && data.data.chapterVoList) {
        const episodeList = data.data.chapterVoList;

        if (Array.isArray(episodeList)) {
            const ep = episodeList.find((e: any) => String(e.id) === String(episodeId));
            if (ep && ep.m3u8Path) {
                console.log("[GoodShort] Video URL found for episode", episodeId);
                return ep.m3u8Path;
            }
        }
    }

    console.warn("[GoodShort] Video URL not found for", bookId, episodeId);
    return '';
}
