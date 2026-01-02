
import crypto from 'crypto';

function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex').toLowerCase();
}

function generateSign(params) {
    // 1. Filter & Sort keys
    const sortedKeys = Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null)
        .sort();

    // 2. Build Query String
    const queryString = sortedKeys
        .map(key => `${key}=${params[key]}`)
        .join('&');

    // 3. Append Salt
    const salt = 'nW8GqjbdSYRI';
    const stringToSign = queryString + '&signSalt=' + salt;

    console.log('String to sign:', stringToSign);

    // 4. Hash
    return md5(stringToSign);
}

// Test Case from Logs
// Body: {"playlet_id":"1445","chapter_id":"105108","guid":"1a7df84e-7be8-4e2f-928a-615880c41a6d","os":"android"}
// Expected Sign: 80ab00a60d81317eec6b81bcb5ca246f

const testParams = {
    "playlet_id": "1445",
    "chapter_id": "105108",
    "guid": "1a7df84e-7be8-4e2f-928a-615880c41a6d",
    "os": "android"
};

const generated = generateSign(testParams);
console.log('Generated Sign:', generated);
console.log('Expected  Sign:', '80ab00a60d81317eec6b81bcb5ca246f');
console.log('MATCH:', generated === '80ab00a60d81317eec6b81bcb5ca246f');
