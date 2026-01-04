import { normalizeStarShort, type UnifiedDrama } from '../adapter';

const STARSHORT_HEADERS = {
    'Host': 'cdp.starshort.online',
    'language': '4',
    'user-token': 'N4gAYsSN7cNoqVsbIg92YYrZQ8jPjgrNrHa7Q+61ITNc2wgryful8ZYNBtXFoVKZ4bqo2BesFhMfY6UJj3iaff8MH4PR3tKHNBnB/CbNGVHurT3f9rtY3k50mT68a6sRpXUn5OlAWV1Sm/YjcUST77YSfyXaWrqlk1HM6UUKaB8ukcHBYn4GMM6CQR1nHw/r+FIykqNyJKyiR+3pJq596O1xdH5zpH2nbSfgVFbECAP1Ujkv02feeC4P+ZT4lQz5T/OTDOPHnctQshSuY7x2i+3PqZ7bIcBNGXbLZo0v0PbrxaQMgJ9h8/lDyhVZvTjca1VfKEtTYeuvNuUjJv4hrg==',
    'version-str': '2.35.0',
    'pay-version': 'V2',
    'country': 'ID',
    'release': 'iOS 17.0.3',
    'User-Agent': 'StarShort/2.35.0 (com.rlkj.lang.movie; build:2025123104; iOS 17.0.3) Alamofire/5.10.2',
    'client-all-id': '{"idfv":"4D001AAF-2714-42E8-A8C5-EB1110CB67CF","idfa":""}',
    'ua': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'network-type': 'Wi-Fi',
    'device-id': '4D001AAF-2714-42E8-A8C5-EB1110CB67CF',
    'c-type': '3',
    'system-language': 'id-ID',
    'client-id': '1052'
};

export async function fetchStarShort(endpoint: string): Promise<any> {
    try {
        const response = await fetch(endpoint, { headers: STARSHORT_HEADERS });
        if (response.ok) {
            const data = await response.json();
            if (data.code && data.code !== '0' && data.code !== 200) {
                console.warn('[fetchStarShort] API Error: ' + JSON.stringify(data));
                return null;
            }
            return data;
        }
    } catch (e) {
        console.error('[fetchStarShort] Error:', e);
    }
    return null;
}

export async function getStarShortForYou(): Promise<UnifiedDrama[]> {
    // Using ID 593 as per user request example for home tab
    const data = await fetchStarShort('https://cdp.starshort.online/cdp/home/tab/content/v3?homeTabId=593&pageNum=1&pageSize=30&queryHomePage=1');
    return extractList(data);
}

export async function searchStarShort(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchStarShort('https://cdp.starshort.online/cdp/server_api/compilations/search_detail/v2?keyword=' + encodeURIComponent(query) + '&pageNumber=1&pageSize=20');
    return extractList(data);
}

export async function getStarShortDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    // Unpack composite ID: fakeId_compilationsId
    const parts = id.split('_');
    const fakeId = parts[0];
    const compilationsId = parts[1];

    // Inferred implementation based on RadReel logic
    const metadataUrl = 'https://cdp.starshort.online/content/compilations/v2/' + fakeId;

    // 1. Fetch Metadata
    const metadata = await fetchStarShort(metadataUrl);

    if (metadata && metadata.title) {
        const dramaInfo = {
            title: metadata.title,
            cover: metadata.coverImgUrl,
            description: metadata.introduce,
            chapterCount: 0,
            labels: metadata.compilationsTags || [],
            viewCount: metadata.views || metadata.shareTimes || 0,
            source: 'starshort'
        };

        // 2. Fetch Episodes
        const episodeListUrl = 'https://cdp.starshort.online/content/state_res/episodic_movie/movies/' + fakeId;
        const episodeData = await fetchStarShort(episodeListUrl);
        let episodes: any[] = [];

        if (episodeData && Array.isArray(episodeData)) {
            episodes = episodeData.map((ep: any, index: number) => ({
                id: ep.videoFakeId,
                name: 'Episode ' + (index + 1),
                index: index,
                unlock: !ep.lock,
                raw: ep
            }));
            dramaInfo.chapterCount = episodes.length;
        } else if (metadata.videoUrl) {
            // Fallback single episode
            episodes.push({
                id: '0',
                name: 'Putar Film',
                index: 0,
                unlock: true,
                raw: { videoUrl: metadata.videoUrl }
            });
            dramaInfo.chapterCount = 1;
        }

        return { drama: dramaInfo, episodes };
    }
    return { drama: null, episodes: [] };
}

function extractList(data: any): UnifiedDrama[] {
    if (!data) return [];
    let items: any[] = [];
    if (Array.isArray(data)) items = data;
    else if (data.data) items = data.data; // Handling potential wrapper

    return items.map(item => normalizeStarShort(item)).filter(i => i.id);
}
