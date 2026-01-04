
const API_URL = 'https://sapimu.au/shortmax/api/v1/play/219880?lang=en&ep=1';
const TOKEN = '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb';

async function testApi() {
    console.log(`Testing API: ${API_URL}`);
    try {
        const response = await fetch(API_URL, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Accept': 'application/json'
            }
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log('Response Body:', text.substring(0, 500)); // Print first 500 chars

        try {
            const json = JSON.parse(text);
            console.log('Parsed JSON:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('Response is not valid JSON');
        }
    } catch (error) {
        console.error('Fetch Error:', error.message);
    }
}

testApi();
