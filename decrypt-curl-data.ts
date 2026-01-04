import CryptoJS from 'crypto-js';

/**
 * Analisis mendalam untuk ShortTV Mobile API
 * 
 * Observasi:
 * 1. CI header adalah Base64 dengan panjang 172 chars
 * 2. Body adalah Hex dengan panjang 144 dan 180 chars
 * 3. Web API menggunakan key 'shortwebapiaesen' (16 bytes)
 * 4. Kemungkinan Mobile API menggunakan key yang berbeda
 */

const testData = {
    ci: 'cB84jC5euomIy4JVfgJGOtltBiSKonqdJNCncSnnmR6P06F7sn+cWwt3/nOd/wUM+nXY/79fWDVLDjeNIgvK5BgV3119C3wbpfkc7GlkcjghKS4xCqnr2zZTghEs4wnfSgqy6POP93X4IMtAtTYk6dNB5nLdo+86I6RJUzRq9c0=',
    body1: 'E6E98A52710127DA0F5D0230B91DAFF0A64F9FB98857FF52C2CF7C957F9263A69BEB409EE74D37B1C00AC0B4E4F158874E6061803FA74EDBA25C9D94ADDDDA6C6C1F9717E78C276A',
    body2: 'E6E99C5F71143AC1166B072D9928A4E1AE1E87A19A45FF419A9C32EF378475AB84F14ECCB30570EF8B02DDAEE2DB69871C3F30CB6AF62293FF03CBD7ED949F1F2056DD41949D66781E51291533F6DD4660FCE1544DDD7A76F637'
};

console.log('🔍 Deep Analysis of Encrypted Data\n');

// Analyze CI Header
console.log('='.repeat(80));
console.log('📊 CI Header Analysis');
console.log('='.repeat(80));
const ciBytes = CryptoJS.enc.Base64.parse(testData.ci);
console.log(`Base64 length: ${testData.ci.length} chars`);
console.log(`Decoded bytes: ${ciBytes.sigBytes} bytes`);
console.log(`Hex representation: ${ciBytes.toString(CryptoJS.enc.Hex).substring(0, 100)}...`);

// Analyze Body 1
console.log('\n' + '='.repeat(80));
console.log('📊 Body #1 Analysis');
console.log('='.repeat(80));
console.log(`Hex length: ${testData.body1.length} chars`);
console.log(`Bytes: ${testData.body1.length / 2} bytes`);
console.log(`First 32 bytes: ${testData.body1.substring(0, 64)}`);

// Analyze Body 2
console.log('\n' + '='.repeat(80));
console.log('📊 Body #2 Analysis');
console.log('='.repeat(80));
console.log(`Hex length: ${testData.body2.length} chars`);
console.log(`Bytes: ${testData.body2.length / 2} bytes`);
console.log(`First 32 bytes: ${testData.body2.substring(0, 64)}`);

// Try brute force with common patterns
console.log('\n' + '='.repeat(80));
console.log('🔓 Trying Common Key Patterns');
console.log('='.repeat(80));

const patterns = [
    // Exact 16 char keys
    'shortappapiaesen',
    'shortwebapiaesen',
    'iosshortappaese',
    'iosshortwebaese',

    // App identifiers
    'live.shorttv.ios',
    'shorttv.live.app',

    // Variations
    'shortmax_mobile',
    'shortmax_app_v2',
    'shorts_ios_2.14',

    // Reverse patterns
    'neseiappapptroh',  // reverse of shortappapiaesen
    'neseiappbewtroh',  // reverse of shortwebapiaesen
];

function testKey(data: string, key: string, isHex: boolean): boolean {
    try {
        // Ensure 16 bytes
        const keyStr = key.length >= 16 ? key.substring(0, 16) : key.padEnd(16, '0');
        const keyParsed = CryptoJS.enc.Utf8.parse(keyStr);
        const ivParsed = CryptoJS.enc.Utf8.parse(keyStr);

        let encrypted: any = data;
        if (isHex) {
            encrypted = { ciphertext: CryptoJS.enc.Hex.parse(data) };
        }

        const decrypted = CryptoJS.AES.decrypt(encrypted, keyParsed, {
            iv: ivParsed,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        const result = decrypted.toString(CryptoJS.enc.Utf8);

        if (result && result.length > 0) {
            // Check if it's valid text
            const validChars = result.split('').filter(c => {
                const code = c.charCodeAt(0);
                return (code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9;
            }).length;

            const ratio = validChars / result.length;

            if (ratio > 0.8) {
                console.log(`\n✅ Potential match with key: "${keyStr}"`);
                console.log(`   Valid char ratio: ${(ratio * 100).toFixed(1)}%`);
                console.log(`   Result length: ${result.length} chars`);
                console.log(`   Preview: ${result.substring(0, 200)}`);

                try {
                    const json = JSON.parse(result);
                    console.log(`   ✨ Valid JSON!`);
                    console.log(JSON.stringify(json, null, 2));
                } catch {
                    console.log(`   (Not JSON)`);
                }

                return true;
            }
        }
    } catch (e) {
        // Silent fail
    }
    return false;
}

console.log('\nTesting CI Header...');
let found = false;
for (const key of patterns) {
    if (testKey(testData.ci, key, false)) {
        found = true;
        break;
    }
}
if (!found) console.log('❌ No match found for CI Header');

console.log('\n\nTesting Body #1...');
found = false;
for (const key of patterns) {
    if (testKey(testData.body1, key, true)) {
        found = true;
        break;
    }
}
if (!found) console.log('❌ No match found for Body #1');

console.log('\n\nTesting Body #2...');
found = false;
for (const key of patterns) {
    if (testKey(testData.body2, key, true)) {
        found = true;
        break;
    }
}
if (!found) console.log('❌ No match found for Body #2');

console.log('\n' + '='.repeat(80));
console.log('💡 KESIMPULAN:');
console.log('='.repeat(80));
console.log('Jika tidak ada key yang cocok, kemungkinan:');
console.log('1. Key adalah DYNAMIC (generated per request dari timestamp/nonce)');
console.log('2. Menggunakan algoritma selain AES-CBC (misal: AES-GCM, ChaCha20)');
console.log('3. Ada layer encoding tambahan sebelum enkripsi');
console.log('4. Perlu reverse engineering dari binary iOS app untuk mendapatkan key');
console.log('='.repeat(80));
