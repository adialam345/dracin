
const API_BASE = 'https://sapimu.au/hishort/api';
const TOKENS = [
    '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb', // Original
    'ba3f5eb1a23ef0c00dee764bd05cee7bc6606453deca551185301200cf35b941', // kido345
    '8c02960a5aa268ac4ca89b9e86d9d93ea4bb257ed9dc89bc584e3e4aa87c9d8d', // nxxzzz286919
    'b53a335e49b725f092cda317fee26c2707c5eb2f5bc87a60eb1a1367aa6b090e'  // nexsus72
];

async function test(token: string, name: string) {
    console.log(`\nTesting token: ${name} (${token.substring(0, 10)}...)`);
    try {
        const res = await fetch(`${API_BASE}/episode/3687_13?lang=in`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (res.ok) {
            const data = await res.json();
            const sources = data.sources || data.servers;
            const hasSource = sources && sources.length > 0;
            console.log(`Success! Has data.servers/sources: ${hasSource}`);
            if (!hasSource) console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(`Failed! Status: ${res.status} ${res.statusText}`);
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

async function runAll() {
    for (let i = 0; i < TOKENS.length; i++) {
        await test(TOKENS[i], `Token ${i + 1}`);
    }
}

runAll();
