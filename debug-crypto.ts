import CryptoJS from 'crypto-js';

const SECRET_KEY = 'shortwebapiaesen';

// Test 1: Basic encryption/decryption
console.log("=== Test 1: Basic Round Trip ===");
const testData = { foo: "bar", test: 123 };
const plainText = JSON.stringify(testData);

const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
const iv = CryptoJS.enc.Utf8.parse(SECRET_KEY);

const encrypted = CryptoJS.AES.encrypt(plainText, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
});

const encryptedBase64 = encrypted.toString();
console.log("Encrypted (Base64):", encryptedBase64);

const encryptedHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex).toUpperCase();
console.log("Encrypted (Hex):", encryptedHex);

// Decrypt from Base64
const decryptedFromBase64 = CryptoJS.AES.decrypt(encryptedBase64, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
});
console.log("Decrypted from Base64:", decryptedFromBase64.toString(CryptoJS.enc.Utf8));

// Decrypt from Hex
const decryptedFromHex = CryptoJS.AES.decrypt(
    { ciphertext: CryptoJS.enc.Hex.parse(encryptedHex) } as any,
    key,
    {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    }
);
console.log("Decrypted from Hex:", decryptedFromHex.toString(CryptoJS.enc.Utf8));

// Test 2: Decrypt the actual response from curl
console.log("\n=== Test 2: Decrypt Curl Response ===");
const curlResponse = "E6E98B4B75057789191A1A258509B8B3F10BC4F7CB10AE5C94C37BAF68D13EFB8AFD401D17ADB749364589F8E3CE5C8A192961D360A9";
console.log("Curl Response (Hex):", curlResponse);

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
    console.log("Decrypted Result:", result);

    if (result) {
        try {
            const parsed = JSON.parse(result);
            console.log("Parsed JSON:", JSON.stringify(parsed, null, 2));
        } catch {
            console.log("Not JSON, raw string:", result);
        }
    } else {
        console.log("❌ Decryption returned empty string - wrong key/IV or corrupted data");
    }
} catch (error) {
    console.error("❌ Decryption error:", error);
}
