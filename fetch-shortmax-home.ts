
import { encryptData, decryptResponseData } from './src/utils/shortmax-crypto';

const API_BASE = 'https://shortweb.shorttv.live/app-api';
// Trying production domain first as it is cleaner, if fails will try pre
const ENDPOINT = '/app/cmsShortPlay/queryPage';

async function testFetch() {
    const params = { pageNo: 1, pageSize: 10 };
    const encryptedBody = encryptData(params);

    console.log(`Requesting ${API_BASE}${ENDPOINT} with params:`, params);

    const headers = {
        'Accept': 'application/json',
        'x-encrypted': 'true',
        'Accept-Language': 'id-ID,id;q=0.9',
        'Content-Type': 'application/json',
        'language-code': 'id',
        'Origin': 'https://www.shorttv.live',
        'Referer': 'https://www.shorttv.live/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0.1 Mobile/15E148 Safari/604.1'
    };

    try {
        const response = await fetch(`${API_BASE}${ENDPOINT}`, {
            method: 'POST',
            headers: headers,
            body: encryptedBody
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Raw response length: ${text.length}`);

        const decrypted = decryptResponseData(text);

        // Log simplified structure
        if (decrypted && decrypted.data && decrypted.data.list) {
            console.log('Structure: data.list[]');
            console.log('First Item:', JSON.stringify(decrypted.data.list[0], null, 2));
        } else if (decrypted && Array.isArray(decrypted.data)) {
            console.log('Structure: data[]');
            console.log('First Item:', JSON.stringify(decrypted.data[0], null, 2));
        } else {
            console.log('Decrypted (Unknown Structure):', JSON.stringify(decrypted, null, 2));
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

testFetch();
