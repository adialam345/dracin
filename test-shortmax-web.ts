import CryptoJS from 'crypto-js';

const SECRET_KEY = 'shortappapiaesen';

// Request body (encrypted)
const encryptedRequest = "wwhjL/ak/VX6oVx8ysG0cg==";

// Response body (encrypted)
const encryptedResponse = "9MePJ5iXm/LfrSEc7YAS7VhNmRXidjKT7l9UX4iCpj4ad/twzbVXyYiBqpN9uiW55p8KFjMP7tEqbNficJGMUe+nHhWUNPsHQgTkAXkgttKx6g3rDSdqSBTEOsQgsNDH5nmfJpQXC74Hq5csUfE/UdOenImjytyWwotiwfJbUZzuB9uPewcVxmZryfr3JtFrpJXQdltZxh8Kqf/zUK4G+CAxhN8bU8IZss9ULgYxXM/AknxiHXwBhi4aIJnSwg5RLrJygCl+fwZIOMQKprTKAUiXBlaqiMkgjpFlbAAcuOPFN020o898CXNYwnyYCyIcQGPlGGgpri7tmqkYs70AO9r3j6ifCCBxY54hJ6KfZgrYeydN9E83XxTKUzWINZNYGaugCVUz3a3MvL9NXNNDJwnjP+ZvX0+L0qKprrEi+4ggRO23gady02ZqM9MBrNmdneZyQnD5RYt27B8210dkzyKDMxg+TDJrYL4jlIf0TGwBn7YiP/6eDPHHiOFhtgshIGuEaJTyi65a9+0C4JYzzsWej62lNcPAn8PFtrLg9/x4pn6T0GvOEUzXtaAHXSrONPe80FEuGRevgixctIckkhzQP0Cb72M9jZ0Okq8O3UW9urw6lOJXI6p1MeYyOVzMChUW+EK80+PXzgtyMeXqAcMwxx3a2s/29gGWEP0cBkmrH4ZXNAL0Ow/tWr/7I3yAOc21buPC2kCNwQj5nW08i2S/ctMtxx4kw52xKB0939s=";

const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
const iv = CryptoJS.enc.Utf8.parse(SECRET_KEY);

console.log("=== ShortMax Web API Test ===\n");
console.log("Key:", SECRET_KEY);
console.log("Endpoint: /app-api/app/search/searchHot");

// Decrypt Request
console.log("\n--- Decrypting Request ---");
try {
    const decryptedReq = CryptoJS.AES.decrypt(encryptedRequest, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    const reqResult = decryptedReq.toString(CryptoJS.enc.Utf8);

    if (reqResult) {
        console.log("✅ Request Decrypted:", reqResult);
        try {
            const parsed = JSON.parse(reqResult);
            console.log("📦 Parsed:", JSON.stringify(parsed, null, 2));
        } catch {
            console.log("(Not JSON)");
        }
    } else {
        console.log("❌ Empty result");
    }
} catch (error: any) {
    console.error("❌ Error:", error.message);
}

// Decrypt Response
console.log("\n--- Decrypting Response ---");
try {
    const decryptedResp = CryptoJS.AES.decrypt(encryptedResponse, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    const respResult = decryptedResp.toString(CryptoJS.enc.Utf8);

    if (respResult) {
        console.log("✅ Response Decrypted!");
        console.log("\n📦 Full Response:");
        try {
            const parsed = JSON.parse(respResult);
            console.log(JSON.stringify(parsed, null, 2));
        } catch {
            console.log(respResult);
        }
    } else {
        console.log("❌ Empty result");
    }
} catch (error: any) {
    console.error("❌ Error:", error.message);
}
