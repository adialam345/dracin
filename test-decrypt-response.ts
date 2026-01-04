import { decryptData } from './src/utils/shortmax-crypto.ts';

// Response dari curl Anda
const encryptedResponse = "E6E98B4B75057789191A1A258509B8B3F10BC4F7CB10AE5C94C37BAF68D13EFB8AFD401D17ADB749364589F8E3CE5C8A192961D360A9";

console.log("🔐 Encrypted Response (Hex):");
console.log(encryptedResponse);
console.log("\n📦 Decrypting...\n");

try {
    const decrypted = decryptData(encryptedResponse);
    console.log("✅ Decrypted Result:");
    console.log(JSON.stringify(decrypted, null, 2));
} catch (error) {
    console.error("❌ Decryption Failed:");
    console.error(error);
}
