
async function run() {
    const url = 'https://dracinhub.com/system/api/episodes/watched';
    const payload = {
        drama_id: "Bvut92HRHx",
        episode_index: 11,
        session_id: "8d794211-dc92-4717-a2f8-009a236950ae"
    };

    console.log(`Sending POST to ${url}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://dracinhub.com/'
            },
            body: JSON.stringify(payload)
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log('Response:', text);

        try {
            const json = JSON.parse(text);
            console.log('JSON Data:', JSON.stringify(json, null, 2));
        } catch (e) {
            // Not JSON
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
