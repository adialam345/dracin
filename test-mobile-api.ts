import CryptoJS from 'crypto-js';

// Test dengan key untuk Mobile App API
const APP_KEY = 'shortappapiaesen';
const WEB_KEY = 'shortwebapiaesen';

// Request body (encrypted)
const encryptedRequest = "E6E98A52710127DA0F5D0230B91DAFF0A64F9FB98857FF52C2CF7C957F9263A69BEB409EE74D37B1C00AC0B4E4F158874E6061803FA74EDBA25C9D94ADDDDA6C6C1F9717E78C276A";

// CI header (encrypted params)
const encryptedCI = "cB84jC5euomIy4JVfgJGOtltBiSKonqdJNCncSnnmR6P06F7sn+cWwt3/nOd/wUM+nXY/79fWDVLDjeNIgvK5BgV3119C3wbpfkc7GlkcjghKS4xCqnr2zZTghEs4wnfSgqy6POP93X4IMtAtTYk6dNB5nLdo+86I6RJUzRq9c0=";

console.log("=== Testing Mobile App API Encryption ===\n");

// Test 1: Decrypt CI header
console.log("1. Decrypting CI header...");
for (const [name, SECRET_KEY] of [['APP_KEY', APP_KEY], ['WEB_KEY', WEB_KEY]]) {
    console.log(`\n   Testing with ${name}: "${SECRET_KEY}"`);

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
            console.log(`   ✅ SUCCESS!`);
            console.log(`   Decrypted:`, result);
            try {
                const parsed = JSON.parse(result);
                console.log(`   Parsed:`, JSON.stringify(parsed, null, 2));
            } catch {
                console.log(`   (Not JSON)`);
            }
        } else {
            console.log(`   ❌ Empty result`);
        }
    } catch (error: any) {
        console.log(`   ❌ Error:`, error.message);
    }
}

// Test 2: Decrypt Request Body (Hex)
console.log("\n\n2. Decrypting Request Body (Hex)...");
for (const [name, SECRET_KEY] of [['APP_KEY', APP_KEY], ['WEB_KEY', WEB_KEY]]) {
    console.log(`\n   Testing with ${name}: "${SECRET_KEY}"`);

    const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
    const iv = CryptoJS.enc.Utf8.parse(SECRET_KEY);

    try {
        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: CryptoJS.enc.Hex.parse(encryptedRequest) } as any,
            key,
            {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }
        );

        const result = decrypted.toString(CryptoJS.enc.Utf8);

        if (result && result.length > 0) {
            console.log(`   ✅ SUCCESS!`);
            console.log(`   Decrypted:`, result);
            try {
                const parsed = JSON.parse(result);
                console.log(`   Parsed:`, JSON.stringify(parsed, null, 2));
            } catch {
                console.log(`   (Not JSON)`);
            }
        } else {
            console.log(`   ❌ Empty result`);
        }
    } catch (error: any) {
        console.log(`   ❌ Error:`, error.message);
    }
}
