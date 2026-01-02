
const FETCH_OPT = {
    "headers": {
        "__cxy_app_ver_": "25.1.1",
        "__cxy_duid_": "ba316443-7e4a-408e-8137-ec9fade65152", // Static Device ID?
        "__cxy_jwtoken_": "",
        "__cxy_timezone_": "25200",
        "__cxy_token_": "",
        "__cxy_uid_": "",
        "accept": "application/json",
        "content-type": "application/json",
        "sign": "80ab00a60d81317eec6b81bcb5ca246f",
        "web-system": "android",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    "referrer": "https://www.flickreels.net/",
    "method": "POST"
};

async function testWebAPI(playletId, chapterId) {
    console.log(`Testing Web API for Playlet ${playletId}, Chapter ${chapterId}...`);

    // Body from user
    const body = {
        "playlet_id": playletId,
        "chapter_id": chapterId,
        "guid": "1a7df84e-7be8-4e2f-928a-615880c41a6d", // Static GUID?
        "os": "android"
    };

    try {
        const res = await fetch("https://apiweb.flickreels.net/web/playlet/play", {
            ...FETCH_OPT,
            body: JSON.stringify(body)
        });

        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
        return data;
    } catch (e) {
        console.error('Error:', e);
    }
}

async function run() {
    // 1. Replay Original (ID 1445, Chapter 105108) - Expect Success
    console.log('--- REPLAY ORIGINAL ---');
    await testWebAPI("1445", "105108");

    // 2. Try Different Chapter (same drama) - Guessing chapter ID +1? Not reliable without listing.
    // Let's just try changing playlet_id to 533 (known good ID) and see if sign fails
    console.log('\n--- CHANGE PLAYLET ID (533) ---');
    // Note: We need a valid chapter_id for 533. 
    // From previous logs, reliable chapter id for 533 is "42499" (Episode 1)
    await testWebAPI("533", "42499");
}

run();
