const https = require('https');
const zlib = require('zlib');

// VIP Headers from previous session
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

function fetchDW(url) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            method: 'GET',
            headers: HEADERS,
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            port: 443
        };
        // No Content-Type for GET
        delete options.headers['Content-Type'];

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

                    const data = JSON.parse(buffer.toString());
                    resolve(data);
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', (e) => resolve(null));
        req.end();
    });
}

async function verifyTitle() {
    const id = 'BTRhXQ9fOC';
    console.log(`Checking Info for ID: ${id}`);
    const data = await fetchDW(`https://api.mydramawave.com/dm-api/drama/info_v2?campaign=&series_id=${id}`);

    if (data?.data?.info) {
        console.log('Title:', data.data.info.name);
        console.log('Cover:', data.data.info.cover);
    } else {
        console.log('Drama Not Found / API Error');
        console.log(JSON.stringify(data, null, 2));
    }
}

verifyTitle();
