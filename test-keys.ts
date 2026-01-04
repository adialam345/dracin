import CryptoJS from 'crypto-js';

const KEYS_TO_TRY = [
    'shortappapiaesen',
    'shortwebapiaesen',
    'shorttv',
    'shortmax',
];

const curlResponse = "E6E98B4B75057789191A1A258509B8B3F10BC4F7CB10AE5C94C37BAF68D13EFB8AFD401D17ADB749364589F8E3CE5C8A192961D360A9";

console.log("Testing different keys...\n");

for (const SECRET_KEY of KEYS_TO_TRY) {
    console.log(`\n=== Testing Key: "${SECRET_KEY}" ===`);

    const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
    const iv = CryptoJS.enc.Utf8.parse(SECRET_KEY);

    try {
        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: CryptoJS.enc.Hex.parse(curlResponse) } as any,
            key,
            {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }
        );
        const result = decrypted.toString(CryptoJS.enc.Utf8);

        if (result && result.length > 0) {
            console.log("✅ SUCCESS! Decrypted:", result);
            try {
                const parsed = JSON.parse(result);
                console.log("📦 Parsed JSON:", JSON.stringify(parsed, null, 2));
            } catch {
                console.log("(Not JSON)");
            }
            break;
        } else {
            console.log("❌ Empty result");
        }
    } catch (error: any) {
        console.log("❌ Error:", error.message);
    }
}

// Also try with zero IV
console.log("\n\n=== Testing with Zero IV ===");
const SECRET_KEY = 'shortappapiaesen';
const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
const zeroIv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');

try {
    const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Hex.parse(curlResponse) } as any,
        key,
        {
            iv: zeroIv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
    );
    const result = decrypted.toString(CryptoJS.enc.Utf8);

    if (result && result.length > 0) {
        console.log("✅ SUCCESS with zero IV! Decrypted:", result);
    } else {
        console.log("❌ Empty result with zero IV");
    }
} catch (error: any) {
    console.log("❌ Error with zero IV:", error.message);
}
