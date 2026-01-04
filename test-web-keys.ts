import CryptoJS from 'crypto-js';

const KEYS_TO_TRY = [
    'shortappapiaesen',
    'shortwebapiaesen',
    'shortweb',
    'shorttvweb',
    'shortmax',
    'shorttv',
];

const encryptedResponse = "9MePJ5iXm/LfrSEc7YAS7VhNmRXidjKT7l9UX4iCpj4ad/twzbVXyYiBqpN9uiW55p8KFjMP7tEqbNficJGMUe+nHhWUNPsHQgTkAXkgttKx6g3rDSdqSBTEOsQgsNDH5nmfJpQXC74Hq5csUfE/UdOenImjytyWwotiwfJbUZzuB9uPewcVxmZryfr3JtFrpJXQdltZxh8Kqf/zUK4G+CAxhN8bU8IZss9ULgYxXM/AknxiHXwBhi4aIJnSwg5RLrJygCl+fwZIOMQKprTKAUiXBlaqiMkgjpFlbAAcuOPFN020o898CXNYwnyYCyIcQGPlGGgpri7tmqkYs70AO9r3j6ifCCBxY54hJ6KfZgrYeydN9E83XxTKUzWINZNYGaugCVUz3a3MvL9NXNNDJwnjP+ZvX0+L0qKprrEi+4ggRO23gady02ZqM9MBrNmdneZyQnD5RYt27B8210dkzyKDMxg+TDJrYL4jlIf0TGwBn7YiP/6eDPHHiOFhtgshIGuEaJTyi65a9+0C4JYzzsWej62lNcPAn8PFtrLg9/x4pn6T0GvOEUzXtaAHXSrONPe80FEuGRevgixctIckkhzQP0Cb72M9jZ0Okq8O3UW9urw6lOJXI6p1MeYyOVzMChUW+EK80+PXzgtyMeXqAcMwxx3a2s/29gGWEP0cBkmrH4ZXNAL0Ow/tWr/7I3yAOc21buPC2kCNwQj5nW08i2S/ctMtxx4kw52xKB0939s=";

console.log("Testing different keys for Web API...\n");

for (const SECRET_KEY of KEYS_TO_TRY) {
    console.log(`\n=== Testing Key: "${SECRET_KEY}" ===`);

    const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
    const iv = CryptoJS.enc.Utf8.parse(SECRET_KEY);

    try {
        const decrypted = CryptoJS.AES.decrypt(encryptedResponse, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        const result = decrypted.toString(CryptoJS.enc.Utf8);

        if (result && result.length > 0) {
            console.log("✅ SUCCESS!");
            console.log("Decrypted length:", result.length);
            console.log("First 200 chars:", result.substring(0, 200));

            try {
                const parsed = JSON.parse(result);
                console.log("\n📦 Full JSON:");
                console.log(JSON.stringify(parsed, null, 2));
                break;
            } catch {
                console.log("(Not valid JSON)");
            }
        } else {
            console.log("❌ Empty result");
        }
    } catch (error: any) {
        console.log("❌ Error:", error.message);
    }
}
