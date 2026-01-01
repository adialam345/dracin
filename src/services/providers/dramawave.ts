import https from 'https';
import zlib from 'zlib';
import { normalizeDramaWave, type UnifiedDrama } from '../adapter';

const DRAMAWAVE_BASE_AUTH = {
    // OLD TOKEN (Validation passes)
    oauth_signature: 'cca7cf0fb4c05ec354e08b59993360d9',
    oauth_token: 'uqLUbfoAbgOpjSqXaWzq41b27czoEYag'
};

function getDramaWaveHeaders(isVipMode: boolean = false): Record<string, string> {
    const timestamp = '1767280565428';

    // Config for Library Access (Suami Sewaan exists here)
    const LIB_APP = {
        name: 'com.dramabuzz.app',
        ver: '1.7.00',
        ua: 'DramaWave/1.7.00 (iPhone; iOS 17.0.3; Scale/3.00)',
        appsflyer: '1767263420779-3169624'
    };

    // Config for VIP Access (Premium actually works here)
    const VIP_APP = {
        name: 'com.freereels.app',
        ver: '2.1.00',
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0.1 Mobile/15E148 Safari/604.1',
        appsflyer: '1767286674238-964377822658472300'
    };

    const SELECTED = isVipMode ? VIP_APP : LIB_APP;

    return {
        // PERMANENT VIP CREDENTIALS (Session & Device)
        'session-id': '1bf35e42-4f79-4ff9-a9de-689316ccf138',
        'device-id': 'af25a4fb-5739-4b3b-bee5-068add56cac3',

        // AUTH
        'Authorization': `oauth_signature=${DRAMAWAVE_BASE_AUTH.oauth_signature},oauth_token=${DRAMAWAVE_BASE_AUTH.oauth_token},ts=${timestamp}`,

        // DYNAMIC APP IDENTITY
        'app-name': SELECTED.name,
        'app-version': SELECTED.ver,
        'User-Agent': SELECTED.ua,
        'x-appsflyer_id': SELECTED.appsflyer,
        'appsflyer-id': SELECTED.appsflyer,

        // DEVICE (Shared)
        'device': 'ios',
        'x-device-model': 'iPhone',

        // STANDARD HEADERS
        'language': 'id-ID',
        'country': 'ID',
        'timezone': '+7',
        'screen-width': '390',
        'screen-height': '844',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
    };
}

// Add extra arg to fetch function to pass mode
export function fetchDramaWave(endpoint: string, method: string = 'GET', body: any = null, isVipMode: boolean = false): Promise<any> {
    return new Promise((resolve) => {
        try {
            const urlObj = new URL(endpoint);
            const headers = getDramaWaveHeaders(isVipMode); // PASS MODE
            headers['Accept-Encoding'] = 'gzip, deflate, br';
            headers['Connection'] = 'keep-alive';

            if (body) {
                headers['Content-Type'] = 'application/json';
            }

            // ... rest of fetch implementation

            const options: https.RequestOptions = {
                method: method,
                headers: headers,
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                port: 443
            };

            const req = https.request(options, (res) => {
                let chunks: any[] = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        console.warn('[fetchDramaWave] HTTP Error:', res.statusCode);
                        resolve(null);
                        return;
                    }

                    try {
                        let buffer = Buffer.concat(chunks);
                        const encoding = res.headers['content-encoding'];
                        if (encoding === 'gzip') {
                            buffer = zlib.gunzipSync(buffer);
                        } else if (encoding === 'deflate') {
                            buffer = zlib.inflateSync(buffer);
                        } else if (encoding === 'br') {
                            buffer = zlib.brotliDecompressSync(buffer);
                        }

                        const text = buffer.toString();
                        const data = JSON.parse(text);

                        if (data.code && data.code !== 200) {
                            console.warn('[fetchDramaWave] API Error: ' + JSON.stringify(data));
                            resolve(null);
                            return;
                        }

                        resolve(data.data || null);
                    } catch (e) {
                        console.error('[fetchDramaWave] Parse Error:', e);
                        resolve(null);
                    }
                });
            });

            req.on('error', (e) => {
                console.error('[fetchDramaWave] Req Error:', e);
                resolve(null);
            });

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();

        } catch (e) {
            console.error('[fetchDramaWave] Setup Error:', e);
            resolve(null);
        }
    });
}

export async function getDramaWaveForYou(): Promise<UnifiedDrama[]> {
    const data = await fetchDramaWave('https://api.mydramawave.com/dm-api/foryou/feed?next=');
    return extractList(data);
}

export async function searchDramaWave(query: string, maxPages: number = 20): Promise<UnifiedDrama[]> {
    let allItems: any[] = [];
    let nextCursor = '';
    let page = 0;

    while (page < maxPages) {
        const res = await fetchDramaWave('https://api.mydramawave.com/dm-api/search/drama', 'POST', {
            keyword: query,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            next: nextCursor
        });

        if (res && res.items) {
            allItems = allItems.concat(res.items);
            if (res.page_info && res.page_info.has_more && res.page_info.next) {
                nextCursor = res.page_info.next;
                page++;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    return extractList({ items: allItems });
}

export async function getDramaWaveDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    const detailUrl = `https://api.mydramawave.com/dm-api/drama/info_v2?campaign=&series_id=${id}`;
    // USE VIP MODE HERE (true) to unlock videos!
    const detailData = await fetchDramaWave(detailUrl, 'GET', null, true);

    if (detailData && detailData.info) {
        const info = detailData.info;
        const dramaInfo = {
            title: info.name,
            cover: info.cover,
            description: info.desc,
            chapterCount: info.episode_count || info.episode_list?.length || 0,
            labels: info.series_tag || [],
            source: 'dramawave'
        };

        const episodes = (info.episode_list || []).map((ep: any, index: number) => ({
            id: ep.id,
            name: ep.name || `Episode ${index + 1}`,
            index: index,
            unlock: true, // We unlock everything via headers
            raw: ep
        }));

        return { drama: dramaInfo, episodes };
    }
    return { drama: null, episodes: [] };
}

function extractList(data: any): UnifiedDrama[] {
    if (!data) return [];
    let items: any[] = [];
    if (data && data.items) items = data.items;
    else if (data && data.list) items = data.list;
    else if (Array.isArray(data)) items = data;

    return items.map(item => normalizeDramaWave(item)).filter(i => i.id);
}
