
import crypto from 'crypto';

const BASE = 'https://apiweb.flickreels.net/web/playlet';

function generateSign(params) {
    const sortedKeys = Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null)
        .sort();
    const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    const salt = 'nW8GqjbdSYRI';
    return crypto.createHash('md5').update(queryString + '&signSalt=' + salt).digest('hex').toLowerCase();
}

async function run() {
    const endpoint = '/chapterList';
    const body = {
        "playlet_id": "4793",
        "os": "android",
        "guid": "1a7df84e-7be8-4e2f-928a-615880c41a6d"
    };

    const sign = generateSign(body);
    const headers = {
        "__cxy_app_ver_": "25.1.1",
        "__cxy_duid_": "ba316443-7e4a-408e-8137-ec9fade65152",
        "content-type": "application/json",
        "sign": sign,
        "web-system": "android",
        "referrer": "https://www.flickreels.net/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    console.log(`Testing ${endpoint}...`);
    try {
        const res = await fetch(BASE + endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
            headers
        });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        // Log first 500 chars to see structure
        console.log('Response:', text.substring(0, 500));

        // Log if successful data found
        if (text.includes('"list":')) {
            console.log('\nSUCCESS! Found list data.');
        } else {
            console.log('\nFailed to find list data.');
        }

    } catch (e) {
        console.log(`ERR:`, e.message);
    }
}

run();
