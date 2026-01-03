const https = require('https');
const crypto = require('crypto');

const FLICKREELS_SEARCH_API = 'https://api.farsunpteltd.com/app/user_search';

const FLICKREELS_MOB_HEADERS = {
    'bundleIdentifier': 'com.farsun.shortplay',
    'Version': '2.2.2.0',
    'Token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJfIiwiYXVkIjoiXyIsImlhdCI6MTc2NzI5NTM2OSwiZGF0YSI6eyJtZW1iZXJfaWQiOjQ1MTMwNTUwLCJwYWNrYWdlX2lkIjoiMSIsIm1haW5fcGFja2FnZV9pZCI6IjEwMCJ9fQ.U2HoYm4QEZfZ_QU9eGkzOzzQZRPGfeLKIc3qzefchQQ',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Accept-Language': 'id-ID;q=1.0',
    'Timezone': 'Asia/Jakarta'
};

const DEFAULT_MOB_BODY = {
    "language_id": "6",
    "device_id": "47540D07-1CB4-40AB-A357-20093F4DD4C6",
    "os": "ios",
    "device_brand": "iPhone13,2",
    "countryCode": "IDN",
    "apps_flyer_uid": "1767294896845-4754007",
    "device_sign": "605a95670966c04beb3e0026b33941185e6fd5396dd70552f8aeb0fe5f6413c7",
    "device_number": "17.0.3",
    "main_package_id": "100"
};

function generateSign(params) {
    const sortedKeys = Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null)
        .sort();

    const queryString = sortedKeys
        .map(key => {
            let val = params[key];
            if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
                val = JSON.stringify(val);
            }
            return `${key}=${val}`;
        })
        .join('&');

    const salt = 'nW8GqjbdSYRI';
    const stringToSign = queryString + '&signSalt=' + salt;

    return crypto.createHash('md5').update(stringToSign).digest('hex').toLowerCase();
}

function fetchFlickReels(url, method = 'POST', headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            method: method,
            headers: headers,
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            port: 443
        };

        const req = https.request(options, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const text = buffer.toString();
                try {
                    const data = JSON.parse(text);
                    resolve(data);
                } catch (e) {
                    console.error('JSON Parse Error:', text);
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function testSearch(keyword) {
    console.log(`Testing FlickReels Search for: "${keyword}"`);
    const body = {
        ...DEFAULT_MOB_BODY,
        keyword: keyword,
        is_mid_page: "1"
    };

    const sign = generateSign(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const headers = {
        ...FLICKREELS_MOB_HEADERS,
        'Sign': sign,
        'Timestamp': timestamp
    };

    try {
        const response = await fetchFlickReels(FLICKREELS_SEARCH_API + '/search', 'POST', headers, body);
        if (response && response.data) {
            console.log(`Found ${response.data.length} items.`);
            response.data.forEach(item => {
                console.log(`- [${item.playlet_id}] ${item.title}`);
            });
        } else {
            console.log('No data found or error:', response);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

testSearch('suami');
