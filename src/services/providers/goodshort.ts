
import { normalizeGoodShort, type UnifiedDrama } from '../adapter';

const API_BASE = 'https://api-akm.goodreels.com/hwycclientreels';

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

const SEARCH_HEADERS = {
    ...HOME_HEADERS,
    "sign": "jXd6eAIcRdzOzSCWjbVWuHAnchUY7PtL+UiO18tnemw0pQ45qH0zrLRelqBJkrSdU+J7/Ij5/Vecgg3PZbAaVNfKmfLkff5SDWU7INOg6G4hgVCiBCSz32ilyisK23rq7+GrsFUP1PRZ35ncutu/QoQn5LncOLdPLfgfKVZJ4do7XIVtZTt79ET2pQOZQ8DN3uXDmdRRDQsDUvpIlBlwayEXXHKaNxSNCwLYWfXRyTVBTv16S+pKgfzSCnwemWkxTaG+R+wUr2Exq+y7iRtuwZeF3lTdUW0rB+2p/M8uHWyvzJOJkAt64EvaQfQ8FPSckosSZ1QQO7Dnra1hqUV0UQ=="
};

const DETAIL_HEADERS = {
    ...HOME_HEADERS,
    "sign": "Q0CcYw+9Ma+h6hq16wNUUhxX8qS+FMzZmKZBX4OcBbnBAURWbL0NzVsX5aF4c8pv8dVN5ko8qdlkTdULtMF5mnufJ5+LTnjcA2k935RH3mfbEgUcfA+3Wh5ei87ykx+5TbrxeuBTMrBMnU6h8N06gQ1abLY1CC4Zmy2+QNjJE3zUfbu+YBC8ORsxhMTP0bwQZWJWqF4mt9AuR4AV6LLwKwaq4GlmP4QEYFec4FcqMECz56oQi2YGvkKEggqSvduHn5asS8Nl0lFiD6KADACQU8xQnA36hmX1bX2M+d7MAivU8InVwm2WRbolJTygynWlZDoJk/LysFXKu7L29A7tzA=="
};

async function fetchGoodShort(url: string, body: any, headers: any = HOME_HEADERS) {
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

export async function getGoodShortHome(): Promise<UnifiedDrama[]> {
    const url = `${API_BASE}/home/index?timestamp=1767620758012`;
    // Using simple body for Home
    const body = {
        "pageNo": 1,
        "vipBookEnable": false,
        "channelType": 1,
        "pageSize": 30,
        "channelId": "-1",
        "index": ""
    };

    const data = await fetchGoodShort(url, body, HOME_HEADERS);
    if (!data || !data.data || !data.data.records) return [];

    let allItems: any[] = [];
    // Traverse sections
    data.data.records.forEach((section: any) => {
        if (section.items && Array.isArray(section.items)) {
            allItems = [...allItems, ...section.items];
        } else if (section.id && section.cover) {
            // If the record itself is a drama (fallback)
            allItems.push(section);
        }
    });

    return allItems.map(normalizeGoodShort);
}

export async function searchGoodShort(query: string): Promise<UnifiedDrama[]> {
    // WARNING: Signature is likely bound to the keyword.
    // We try to use the provided sign for generic search, BUT if query changes, sign might be invalid.
    // Since we don't have the signing algo, we try our best.
    const url = `${API_BASE}/book/search1?timestamp=1767620763423`;
    const body = {
        "pageSize": 20,
        "keyword": query,
        "pageNo": 1
    };

    // Use SEARCH_HEADERS. If query is diff from 'suami', this might fail if server checks sign vs body.
    const data = await fetchGoodShort(url, body, SEARCH_HEADERS);

    if (!data || !data.data) return [];

    // Check if data.data.searchResult.records exists or data.data.list
    let list: any[] = [];
    if (data.data.searchResult && Array.isArray(data.data.searchResult.records)) {
        list = data.data.searchResult.records;
    } else if (data.data.list && Array.isArray(data.data.list)) {
        list = data.data.list;
    } else if (data.data.records && Array.isArray(data.data.records)) {
        list = data.data.records;
    }

    return list.map(normalizeGoodShort);
}

export async function getGoodShortDetail(id: string): Promise<{ drama: UnifiedDrama, episodes: any[], videoUrl?: string } | null> {
    const url = `${API_BASE}/book/quick/open?timestamp=1767620771981`;
    const body = {
        "bookId": id.toString(),
        "chapterId": 0
    };

    // Use DETAIL_HEADERS
    const data = await fetchGoodShort(url, body, DETAIL_HEADERS);

    // data.data contains { book: {...}, list: [...] }
    if (!data || !data.data) return null;

    const result = data.data;
    const bookInfo = result.book || result; // Fallback if book is not nested

    // Episodes are in result.list, NOT result.chapterList!
    const episodeList = result.list || result.chapterList || [];

    // Normalize logic for detail response
    const drama = normalizeGoodShort({
        ...bookInfo,
        bookId: bookInfo.bookId || id,
        name: bookInfo.bookName || bookInfo.name || bookInfo.title,
        introduction: bookInfo.introduction || bookInfo.desc || 'No description available',
        cover: bookInfo.cover || bookInfo.bookDetailCover,
        chapterCnt: bookInfo.chapterCount || bookInfo.chapterCnt || episodeList.length
    });

    let episodes: any[] = [];
    if (episodeList && Array.isArray(episodeList)) {
        episodes = episodeList.map((ep: any, index: number) => {
            // Extract video URL from cdnList if available
            let videoUrl = '';
            if (ep.cdnList && Array.isArray(ep.cdnList) && ep.cdnList.length > 0) {
                // cdnList[0] has { cdnDomain, videoPath }
                const cdn = ep.cdnList[0];
                videoUrl = cdn.videoPath || '';
            }

            return {
                id: ep.id ? ep.id.toString() : String(index + 1),
                name: ep.chapterName || `Episode ${index + 1}`,
                index: index,
                unlock: ep.price === 0 || ep.status === 1,
                raw: { ...ep, videoUrl }
            };
        });
    }

    console.log("[GoodShort] Detail fetched for", id, "- Episodes:", episodes.length);
    return { drama, episodes };
}

export async function getGoodShortVideoUrl(bookId: string, episodeId: string): Promise<string> {
    // Call the detail API and find the episode with matching ID
    const url = `${API_BASE}/book/quick/open?timestamp=1767620771981`;
    const body = {
        "bookId": bookId,
        "chapterId": 0  // Get all episodes
    };

    const data = await fetchGoodShort(url, body, DETAIL_HEADERS);

    if (data && data.data) {
        const res = data.data;

        // Episodes are in res.list
        const episodeList = res.list || res.chapterList || [];

        if (Array.isArray(episodeList)) {
            const ep = episodeList.find((e: any) => String(e.id) === String(episodeId));
            if (ep && ep.cdnList && Array.isArray(ep.cdnList) && ep.cdnList.length > 0) {
                // Return the videoPath from first CDN
                const cdn = ep.cdnList[0];
                const videoUrl = cdn.videoPath || '';
                console.log("[GoodShort] Video URL found for episode", episodeId, ":", videoUrl.substring(0, 80));
                return videoUrl;
            }
        }
    }

    console.warn("[GoodShort] Video URL not found for", bookId, episodeId);
    return '';
}
