import CryptoJS from 'crypto-js';

const SECRET_KEY = 'shortappapiaesen';

// Dari trace Anda, response JSON adalah:
// {"result":"E6E98B4B75057789191A1A258509B8B3F10BC4F7CB10AE5C94C37BAF68D13EFB8AFD401D17ADB749364589F8E3CE5C8A192961D360A9"}

const responseJson = {
    result: "E6E98B4B75057789191A1A258509B8B3F10BC4F7CB10AE5C94C37BAF68D13EFB8AFD401D17ADB749364589F8E3CE5C8A192961D360A9"
};

console.log("Full Response:", JSON.stringify(responseJson, null, 2));
console.log("\nEncrypted result field:", responseJson.result);
console.log("Length:", responseJson.result.length);
console.log("Key:", SECRET_KEY);

const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
const iv = CryptoJS.enc.Utf8.parse(SECRET_KEY);

try {
    // Try decrypting the hex string
    const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Hex.parse(responseJson.result) } as any,
        key,
        {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
    );

    const result = decrypted.toString(CryptoJS.enc.Utf8);

    if (result && result.length > 0) {
        console.log("\n✅ Decryption SUCCESS!");
        console.log("Decrypted:", result);

        try {
            const parsed = JSON.parse(result);
            console.log("\n📦 Parsed JSON:");
            console.log(JSON.stringify(parsed, null, 2));
        } catch {
            console.log("(Raw string, not JSON)");
        }
    } else {
        console.log("\n❌ Decryption failed - empty result");
        console.log("This might mean:");
        console.log("1. Wrong encryption key");
        console.log("2. Wrong IV");
        console.log("3. Different encryption algorithm");
        console.log("4. Response is not actually encrypted");
    }
} catch (error: any) {
    console.error("\n❌ Error:", error.message);
}

// Let's also check if maybe it's just a boolean response
console.log("\n\n=== Alternative: Maybe it's just a boolean? ===");
console.log("If we interpret the hex as raw data:");
const hexBuffer = Buffer.from(responseJson.result, 'hex');
console.log("Buffer:", hexBuffer);
console.log("As string:", hexBuffer.toString('utf8'));
