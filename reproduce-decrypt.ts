
import CryptoJS from 'crypto-js';

const ENCRYPTED_BODY = "Q7M22I1iyCHjVyKYRbcY0blooXZ88hvDTtPZFdSmQvg=";
const KEYS_TO_TRY = [
    'shortwebapiaesen', // Most likely for web
    'shortappapiaesen',
    'shorttv',
    'shortmax',
    'shorttvapiaesen',
    'shortmaxapiaesen',
    'shorttv.live',
    'shorttv.live_key'
];

console.log(`Trying to decrypt: ${ENCRYPTED_BODY}`);

for (const keyString of KEYS_TO_TRY) {
    try {
        const key = CryptoJS.enc.Utf8.parse(keyString);
        const iv = CryptoJS.enc.Utf8.parse(keyString); // Assuming IV == Key as per shortmax-crypto.ts

        const decrypted = CryptoJS.AES.decrypt(ENCRYPTED_BODY, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        const result = decrypted.toString(CryptoJS.enc.Utf8);

        if (result && result.length > 0) {
            console.log(`\n✅ Decrypted successfully with key: "${keyString}"`);
            console.log(`Result: ${result}`);

            try {
                console.log(`JSON parsed:`, JSON.parse(result));
            } catch (e) {
                console.log(`(Not valid JSON)`);
            }
        }
    } catch (e) {
        // console.log(`Failed with key: ${keyString}`);
    }
}
