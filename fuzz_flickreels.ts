
const BASE = 'https://api.farsunpteltd.com/app/playlet';
const HEADERS = {
    'bundleIdentifier': 'com.farsun.shortplay',
    'Version': '1.0.0', // Try resetting version
    'Token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJfIiwiYXVkIjoiXyIsImlhdCI6MTc2NzI5NTM2OSwiZGF0YSI6eyJtZW1iZXJfaWQiOjQ1MTMwNTUwLCJwYWNrYWdlX2lkIjoiMSIsIm1haW5fcGFja2FnZV9pZCI6IjEwMCJ9fQ.U2HoYm4QEZfZ_QU9eGkzOzzQZRPGfeLKIc3qzefchQQ',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Sign': ''
};

async function tryEndpoint(path, body) {
    console.log(`Testing ${path}...`);
    try {
        const res = await fetch(BASE + path, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(body)
        });
        const text = await res.text();
        console.log(`[${res.status}] ${path}:`, text.substring(0, 200));
    } catch (e) {
        console.log(`[ERR] ${path}:`, e.message);
    }
}

async function run() {
    const body = {
        "playlet_id": "4793",
        "language_id": "6",
        "device_id": "47540D07-1CB4-40AB-A357-20093F4DD4C6"
    };

    await tryEndpoint('/detail', body);
    await tryEndpoint('/info', body);
    await tryEndpoint('/getPlayletInfo', body);
    await tryEndpoint('/chapterList', body); // No sign
}

run();
