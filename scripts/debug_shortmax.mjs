
import fetch from 'node-fetch';

async function test() {
    // Hardcoded known working url form previous run to save time/requests
    // Actually the auth_key expires, so I must fetch fresh.

    // ... Copy paste previous logic ...
    const API_TOKENS = [
        '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb',
        'ba3f5eb1a23ef0c00dee764bd05cee7bc6606453deca551185301200cf35b941',
        '8c02960a5aa268ac4ca89b9e86d9d93ea4bb257ed9dc89bc584e3e4aa87c9d8d',
        'b53a335e49b725f092cda317fee26c2707c5eb2f5bc87a60eb1a1367aa6b090e'
    ];
    function getRandomToken() { return API_TOKENS[Math.floor(Math.random() * API_TOKENS.length)]; }

    try {
        const searchUrl = `https://dramabos.asia/api/shortmax/api/v1/search?q=Love&lang=id`;
        const searchRes = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${getRandomToken()}` } });
        const searchJson = await searchRes.json();
        const id = searchJson.data[0].code || searchJson.data[0].id;

        const playUrl = `https://dramabos.asia/api/shortmax/api/v1/play/${id}?lang=id&ep=1`;
        const playRes = await fetch(playUrl, { headers: { 'Authorization': `Bearer ${getRandomToken()}` } });
        const playJson = await playRes.json();
        const v = playJson.data.video;
        const mainUrl = typeof v === 'string' ? v : (v.video_720 || v.video_1080 || v.video_480);

        console.log("Testing Manifest Fetch WITHOUT Referer...");
        const m3u8Res = await fetch(mainUrl); // No headers
        console.log(`Manifest Status: ${m3u8Res.status}`);

        if (m3u8Res.ok) {
            console.log("Manifest Access: OK");
            // Now test Segment
            const baseUrl = mainUrl.substring(0, mainUrl.lastIndexOf('/') + 1);
            const segmentUrl = baseUrl + "main.m3u8_0.ts"; // Assuming structure based on previous log
            // Note: Does segment need auth_key?
            // The auth_key was in the manifest URL query params.
            // Usually, if auth_key is session based, it refers to the session.
            // If the server checks auth_key for segments, it WON'T be in the segment URL unless the m3u8 is dynamic and injects it (which we saw it didn't).
            // OR maybe it relies on Cookies? (unlikely for CDNs).
            // OR maybe segments are public.

            console.log(`Testing Segment: ${segmentUrl}`);
            const segRes = await fetch(segmentUrl);
            console.log(`Segment Status: ${segRes.status}`);

            if (!segRes.ok && segRes.status === 403) {
                console.log("Segment blocked. Maybe needs auth_key from manifest?");
                // Try appending auth_key to segment
                const urlObj = new URL(mainUrl);
                const authKey = urlObj.searchParams.get('auth_key');
                const segUrlWithKey = segmentUrl + "?auth_key=" + authKey;
                console.log(`Testing Segment with AuthKey: ${segUrlWithKey}`);
                const segRes2 = await fetch(segUrlWithKey);
                console.log(`Segment with Key Status: ${segRes2.status}`);
            }
        } else {
            console.log("Manifest Access: FAILED");
        }

    } catch (e) {
        console.error(e);
    }
}
test();
