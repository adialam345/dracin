const https = require('https');
const zlib = require('zlib');

const HEADERS = {
    'session-id': '1bf35e42-4f79-4ff9-a9de-689316ccf138',
    'device-id': 'af25a4fb-5739-4b3b-bee5-068add56cac3',
    'Authorization': 'oauth_signature=cca7cf0fb4c05ec354e08b59993360d9,oauth_token=uqLUbfoAbgOpjSqXaWzq41b27czoEYag,ts=1767280565428',
    'app-name': 'com.freereels.app',
    'app-version': '2.1.00',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0.1 Mobile/15E148 Safari/604.1',
    'x-device-brand': 'Samsung',
    'x-device-manufacturer': 'Samsung',
    'x-device-model': 'Galaxy A52',
    'x-appsflyer_id': '1767286674238-964377822658472300',
    'appsflyer-id': '1767286674238-964377822658472300',
    'language': 'id-ID',
    'country': 'ID',
    'timezone': '+7',
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json'
};

function fetchDW(url, method = 'POST', body = null) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);

        // Remove host override to let node handle it (avoid mismatch)

        let options = {
            method: method,
            headers: { ...HEADERS },
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            port: 443
        };

        if (method === 'GET') {
            delete options.headers['Content-Type'];
        }

        const req = https.request(options, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                try {
                    let buffer = Buffer.concat(chunks);
                    const encoding = res.headers['content-encoding'];
                    if (encoding === 'gzip') buffer = zlib.gunzipSync(buffer);
                    else if (encoding === 'deflate') buffer = zlib.inflateSync(buffer);
                    else if (encoding === 'br') buffer = zlib.brotliDecompressSync(buffer);

                    const text = buffer.toString();
                    try {
                        const data = JSON.parse(text);
                        resolve(data);
                    } catch (jsonErr) {
                        console.log(`JSON Parse Error on ${url}. Raw: ${text.substring(0, 100)}`);
                        resolve(null);
                    }
                } catch (e) {
                    console.error('Buffer error:', e.message);
                    resolve(null);
                }
            });
        });
        req.on('error', (e) => resolve(null));

        if (body && method !== 'GET') {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function testSearch(keyword) {
    console.log(`\nTesting search for: "${keyword}"`);
    const ENDPOINT = 'https://api.mydramawave.com/dm-api/search/drama';

    let allItems = [];
    let nextCursor = '';
    let page = 0;
    const maxPages = 5;

    console.log('Starting Pagination Loop...');

    while (page < maxPages) {
        console.log(`\nFetching Page ${page + 1}... (Cursor: "${nextCursor}")`);
        const res = await fetchDW(ENDPOINT, 'POST', {
            keyword: keyword,
            next: nextCursor,
            timestamp: Math.floor(Date.now() / 1000).toString()
        });

        if (res?.data?.items) {
            const items = res.data.items;
            console.log(`Got ${items.length} items.`);
            allItems = allItems.concat(items);

            // Check for specific title match
            const found = items.find(item => item.name && item.name.toLowerCase().includes('suami sewaan'));
            if (found) {
                console.log('🎯 FOUND "Suami Sewaan"!');
                console.log('Details:', JSON.stringify(found, null, 2));
            }

            if (res.data.page_info && res.data.page_info.has_more && res.data.page_info.next) {
                nextCursor = res.data.page_info.next;
                page++;
            } else {
                console.log('No more pages.');
                break;
            }
        } else {
            console.log('No items or error.');
            break;
        }
    }

    console.log(`\nTotal Items Fetched: ${allItems.length}`);
    const finalMatch = allItems.find(item => item.name && item.name.toLowerCase().includes('suami sewaan'));
    if (!finalMatch) {
        console.log('❌ "Suami Sewaan" NOT FOUND in fetched items.');
        // Check what DID we find
        console.log('Sample items found:');
        allItems.slice(0, 10).forEach(i => console.log(`- ${i.name}`));
    }
}

testSearch('suami sewaan');
