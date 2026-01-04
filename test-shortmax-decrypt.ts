import CryptoJS from 'crypto-js';

const SECRET_KEY = 'shortappapiaesen';

// Test decrypt the actual response from curl
console.log("=== Test: Decrypt Curl Response ===");
const curlResponse = "E6E98B4B75057789191A1A258509B8B3F10BC4F7CB10AE5C94C37BAF68D13EFB8AFD401D17ADB749364589F8E3CE5C8A192961D360A9";
console.log("Curl Response (Hex):", curlResponse);
console.log("Key:", SECRET_KEY);

const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
const iv = CryptoJS.enc.Utf8.parse(SECRET_KEY);

try {
    const decryptedCurl = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Hex.parse(curlResponse) } as any,
        key,
        {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
    );
    const result = decryptedCurl.toString(CryptoJS.enc.Utf8);

    if (result) {
        console.log("\n✅ Decryption SUCCESS!");
        console.log("Decrypted Result:", result);

        try {
            const parsed = JSON.parse(result);
            console.log("\n📦 Parsed JSON:");
            console.log(JSON.stringify(parsed, null, 2));
        } catch {
            console.log("Not JSON, raw string:", result);
        }
    } else {
        console.log("\n❌ Decryption returned empty string - wrong key/IV or corrupted data");
    }
} catch (error) {
    console.error("\n❌ Decryption error:", error);
}
