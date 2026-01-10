import { normalizeRadReel, type UnifiedDrama, wrapProxyImage } from '../adapter';
import { withCache } from '../utils';

const RADREEL_HEADERS = {
    'Host': 'cdp.wolftv.online',
    'language': '4',
    'User-Agent': 'RadReel/2.7.0 (iPhone; iOS 17.0.3; Scale/3.00)',
    'version-str': '2.7.0',
    'release': 'iOS 17.0.3',
    'country': 'ID',
    'user-token': 'N4gAYsSN7cNoqVsbIg92YYrZQ8jPjgrNrHa7Q+61ITNc2wgryful8ZYNBtXFoVKZ4bqo2BesFhOA092iI/WSNWajH6wmQIfOdZLPh8rejxD6fxO0cq2U+n1ZqzbJoSi4QvKGM6vCh821fvYO71MQoLzSNqDCW/aJLBgdkYXklrMa49WLbAxTkw+0iglllxX4G3ovi7+57qIucQXz3aWE3XPmIzdfp4NaYbQhCMX5bokCw2n6MJYEFAylo9l2PId08/dFRoZja5kh/l827Fv2YUEsjRCJfrQo4RasswkR03TCxB/mO51HFHgbsmIwjcUn5cDa+hr04ZqE5gutrlMwuw==',
    'client-id': '1045'
};

export async function fetchRadReel(endpoint: string): Promise<any> {
    try {
        const response = await fetch(endpoint, { headers: RADREEL_HEADERS });
        if (response.ok) {
            const data = await response.json();
            if (data.code && data.code !== '0' && data.code !== 200) {
                console.warn('[fetchRadReel] API Error: ' + JSON.stringify(data));
                return null;
            }
            return data;
        }
    } catch (e) {
        console.error('[fetchRadReel] Error:', e);
    }
    return null;
}

export async function getRadReelForYou(): Promise<UnifiedDrama[]> {
    const data = await fetchRadReel('https://cdp.wolftv.online/cdp/compilations_recommend_slot/for_you_recommended?index=0');
    const list = extractList(data);

    // Enrich covers for top 10 items because For You endpoint returns 'wrong' (landscape) covers
    // and user wants the Search/Detail (portrait) covers.
    const enrichLimit = 10;
    const toEnrich = list.slice(0, enrichLimit);
    const others = list.slice(enrichLimit);

    await Promise.all(toEnrich.map(async (item) => {
        try {
            // ID format is fakeId_compilationsId or similar
            const fakeId = item.id.split('_')[0];
            if (!fakeId) return;

            const meta = await fetchRadReel(`https://cdp.wolftv.online/content/compilations/v2/${fakeId}`);
            if (meta && meta.coverImgUrl) {
                item.cover = wrapProxyImage(meta.coverImgUrl); // Update cover WITH proxy
            }
        } catch (e) {
            // Ignore enrichment errors
        }
    }));

    return [...toEnrich, ...others];
}

export async function searchRadReel(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchRadReel('https://cdp.wolftv.online/cdp/server_api/compilations/search_detail/v2?keyword=' + encodeURIComponent(query) + '&pageNumber=1&pageSize=20');
    return extractList(data);
}

export async function getRadReelDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    return withCache(`radreel_detail_v2_${id}`, async () => {
        const parts = id.split('_');
        const fakeId = parts[0];
        const metadataUrl = 'https://cdp.wolftv.online/content/compilations/v2/' + fakeId;

        const metadata = await fetchRadReel(metadataUrl);

        if (metadata && metadata.title) {
            const dramaInfo = {
                title: metadata.title,
                cover: metadata.coverImgUrl,
                description: metadata.introduce,
                chapterCount: 0,
                labels: metadata.compilationsTags || [],
                viewCount: metadata.shareTimes || 0,
                source: 'radreel'
            };

            const episodeListUrl = 'https://cdp.wolftv.online/content/state_res/episodic_movie/movies/' + fakeId;
            const episodeData = await fetchRadReel(episodeListUrl);
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
    }, 60 * 60 * 1000);
}

function extractList(data: any): UnifiedDrama[] {
    if (!data) return [];
    let items: any[] = [];
    if (data.forYoucompilationsList) items = data.forYoucompilationsList;
    else if (Array.isArray(data)) items = data;

    return items.map(item => normalizeRadReel(item)).filter(i => i.id);
}
