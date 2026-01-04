import CryptoJS from 'crypto-js';

const KEYS_TO_TRY = [
    'shortappapiaesen',
    'shortwebapiaesen',
    'shorttv',
    'shortmax',
    'shorttvapiaesen',
    'shortmaxapiaesen',
];

const encryptedCI = "cB84jC5euomIy4JVfgJGOtltBiSKonqdJNCncSnnmR6P06F7sn+cWwt3/nOd/wUM+nXY/79fWDVLDjeNIgvK5BgV3119C3wbpfkc7GlkcjghKS4xCqnr2zZTghEs4wnfSgqy6POP93X4IMtAtTYk6dNB5nLdo+86I6RJUzRq9c0=";

console.log("Testing different keys for Mobile App API CI header...\n");

for (const SECRET_KEY of KEYS_TO_TRY) {
    console.log(`Testing: "${SECRET_KEY}"`);

    const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
    const iv = CryptoJS.enc.Utf8.parse(SECRET_KEY);

    try {
        const decrypted = CryptoJS.AES.decrypt(encryptedCI, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        const result = decrypted.toString(CryptoJS.enc.Utf8);

        if (result && result.length > 0) {
            console.log(`✅ SUCCESS with key: "${SECRET_KEY}"`);
            console.log(`Decrypted:`, result);
            try {
                const parsed = JSON.parse(result);
                console.log(`Parsed JSON:`, JSON.stringify(parsed, null, 2));
            } catch {
                console.log(`(Not JSON, raw string)`);
            }
            break;
        }
    } catch (error: any) {
        // Silent
    }
}

// Also try with zero IV
console.log("\n\nTrying with zero IV...");
const SECRET_KEY = 'shortappapiaesen';
const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
const zeroIv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');

try {
    const decrypted = CryptoJS.AES.decrypt(encryptedCI, key, {
        iv: zeroIv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    const result = decrypted.toString(CryptoJS.enc.Utf8);

    if (result && result.length > 0) {
        console.log(`✅ SUCCESS with zero IV!`);
        console.log(`Decrypted:`, result);
    } else {
        console.log(`❌ No success with any key`);
    }
} catch (error: any) {
    console.log(`❌ No success with any key`);
}
