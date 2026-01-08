
import fetch from 'node-fetch';

async function test() {
    // ... setup ...
    const API_TOKENS = [
        '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb',
    ];
    // ... search/play logic ...

    // I will simplify the script to just fetch the HEAD of the m3u8 I found (hardcoded from previous logs if possible, but token expires)
    // So I must re-fetch.

    // ... Re-implementing logic quickly ...
    function getRandomToken() { return API_TOKENS[0]; }

    try {
        const searchRes = await fetch(`https://dramabos.asia/api/shortmax/api/v1/search?q=Love&lang=id`, { headers: { 'Authorization': `Bearer ${getRandomToken()}` } });
        const searchJson = await searchRes.json();
        const id = searchJson.data[0].code || searchJson.data[0].id;

        const playRes = await fetch(`https://dramabos.asia/api/shortmax/api/v1/play/${id}?lang=id&ep=1`, { headers: { 'Authorization': `Bearer ${getRandomToken()}` } });
        const playJson = await playRes.json();
        const v = playJson.data?.video;
        const mainUrl = typeof v === 'string' ? v : ((v?.video_720 || v?.video_1080 || v?.video_480));

        if (mainUrl) {
            console.log(`Checking Content-Type for: ${mainUrl}`);
            const m3u8Res = await fetch(mainUrl, { method: 'HEAD' });
            console.log(`Status: ${m3u8Res.status}`);
            console.log(`Content-Type: ${m3u8Res.headers.get('content-type')}`);
        }
    } catch (e) { console.error(e); }
}
test();
